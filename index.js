import jsforce from 'jsforce'
import config from './config'
import moment from 'moment'
import debug from 'debug'
import events from 'events'
import { Observable, Subject } from 'rxjs/rx'

const dbg = debug('Observer')

export default class RecordSubject extends Subject {

  constructor({ objectName, timeIntervalInSeconds = 30, lastObservationDateTime = (new Date()) }) {
    super()
    this.objectName = objectName
    this.timeIntervalInSeconds = timeIntervalInSeconds
    this.lastObservationDateTime = lastObservationDateTime
    this.pushTopicName = this.createPushTopicName(this.objectName)
    this.handlers = []
    this.updatesLatestDateCovered = this.deletesLatestDateCovered = lastObservationDateTime
    this.streamingEvents = new events.EventEmitter();
  }

  login() {
    dbg(`login('${process.env.SF_USERNAME}', '${process.env.SF_PASSWORD.replace(/./g, '*')}')`)
    this.conn = new jsforce.Connection({ loginUrl: (process.env.SF_SANDBOX.toLowerCase() === 'true') ? 'https://test.salesforce.com' : 'https://login.salesforce.com' /*, logLevel: 'DEBUG' */ })
    return this.conn.login(process.env.SF_USERNAME, process.env.SF_PASSWORD)
  }

  get timeIntervalInMilliseconds() {
    return this.timeIntervalInSeconds * 1000
  }

  subscribe(...args) {
    this.observe()
    return super.subscribe(...args)
  }

  observe() {
    dbg(`
      objectName = ${this.objectName}
      timeIntervalInSeconds = ${this.timeIntervalInSeconds}
      lastObservationDateTime = ${this.lastObservationDateTime.toISOString()}
    `)

    return this.login()
      .then(res => this.createPushTopicIfNotExists({ pushTopicName: this.pushTopicName, objectName: this.objectName }))
      .then(res => {

        // streaming
        Observable.fromEvent(this.streamingEvents, 'message')
          .debounce(x => Observable.timer(1000))
          .subscribe(e => {
            this.pushUpdatedOrDeletedIdsIfNeeded()
          })

        // polling - fallback if streaming isn't reliable
        Observable.timer(this.timeIntervalInMilliseconds, this.timeIntervalInMilliseconds)
          .subscribe(x => {
            this.pushUpdatedOrDeletedIdsIfNeeded()
          })

        dbg(`subscribing to PushTopic named '${this.pushTopicName}'`)
        return this.conn.streaming.topic(this.pushTopicName).subscribe(message => {
          dbg(`message recieved for PushTopic named '${this.pushTopicName}'\n\n${JSON.stringify(message, null, 2)}\n\n`)
          this.streamingEvents.emit('message', message)
        })

      })
      .catch(err => {
        console.error(err)
      })
  }

  pushUpdatedOrDeletedIdsIfNeeded() {
    dbg(`pushUpdatedOrDeletedIdsIfNeeded`)
    this.updatedOrDeletedIds({})
      .then(res => {
        dbg(`updatedOrDeletedIds\n\n${JSON.stringify(res, null, 2)}\n\n`)
        if (res && res.length === 2) {
          const updates = res[0];
          updates.ids
            .map(id => ({ id, type: 'update', objectName: this.objectName }))
            .forEach(update => this.next(update))

          const deletes = res[1];
          deletes.deletedRecords
            .map(rec => Object.assign({}, rec, { type: 'delete', objectName: this.objectName }))
            .forEach(del => this.next(del))
        }
      })
  }


  createPushTopicName(objectName) {
    return `Observer_${objectName}`
  }

  createPushTopic({ pushTopicName, objectName }) {
    dbg(`createPushTopic(${pushTopicName}, ${objectName})`)
    return this.conn.sobject("PushTopic").create({
      'Name': pushTopicName,
      'Query': `SELECT Id FROM ${objectName}`,
      'ApiVersion': 36.0,
      'NotifyForOperationCreate': true,
      'NotifyForOperationUpdate': true,
      'NotifyForOperationUndelete': true,
      'NotifyForOperationDelete': true,
      'NotifyForFields': 'All'
    })
  }

  createPushTopicIfNotExists({ pushTopicName }) {
    dbg(`createPushTopicIfNotExists(${pushTopicName})`)
    const pushTopicExistsSOQL = `SELECT Id FROM PushTopic where Name = '${pushTopicName}'`
    return this.conn.query(pushTopicExistsSOQL)
      .then(res => {
        const shouldCreatePushTopic = (res.totalSize === 0)
        return shouldCreatePushTopic
      })
      .then(shouldCreatePushTopic => {
        if (shouldCreatePushTopic) {
          return this.createPushTopic(pushTopicName)
        } else {
          return Promise.resolve(pushTopicName)
        }
      })
  }

  // handlePushTopicEvent(message) {
  //   this.streamingEvents.emit('message', message)
  //
  //   this.handlers.forEach( handler => handler(message))
  //   dbg('Event Type : ' + message.event.type)
  //   dbg('Event Created : ' + message.event.createdDate)
  //   dbg('Object Id : ' + message.sobject.Id)
  // }

  sobjectGetUpdatedOrDeletedURL({ type, start, end }) {
    const startUTC = start.toISOString().split('.')[0] + '+00:00'
    const endUTC = end.toISOString().split('.')[0] + '+00:00'
    dbg(`sobjectGetUpdatedOrDeletedURL: startUTC = ${startUTC}, endUTC = ${endUTC}`)
    return `/sobjects/Account/${type}/?start=${encodeURIComponent(startUTC)}&end=${encodeURIComponent(endUTC)}`
  }

  updatedIds({ start = this.updatesLatestDateCovered, end = (moment().add(1, 'minutes')) }) {
    const path = this.sobjectGetUpdatedOrDeletedURL({ type: 'updated', start, end })
    const requestTimestamp = new Date()
    return this.conn.requestGet(path)
      .then(res => {
        // e.g. latestDateCovered: '2016-05-10T20:13:00.000+0000'
        //this.updatesLatestDateCovered = new Date(Date.parse(res.latestDateCovered))
        this.updatesLatestDateCovered = requestTimestamp;
        return res
      })
  }

  deletedIds({ start = this.deletesLatestDateCovered, end = (moment().add(1, 'minutes')) }) {
    const path = this.sobjectGetUpdatedOrDeletedURL({ type: 'deleted', start, end })
    const requestTimestamp = new Date()
    return this.conn.requestGet(path)
      .then(res => {
        // e.g. latestDateCovered: '2016-05-10T20:13:00.000+0000'
        // this.deletesLatestDateCovered = new Date(Date.parse(res.latestDateCovered))
        this.deletesLatestDateCovered = requestTimestamp;
        return res
      })
  }

  latestDateCoveredForUpdatesAndDeletes() {
    return (this.updatesLatestDateCovered.getTime() < this.deletesLatestDateCovered.getTime()) ? this.updatesLatestDateCovered : this.deletesLatestDateCovered
  }

  updatedOrDeletedIds({
    start = this.latestDateCoveredForUpdatesAndDeletes(),
    end = (moment().add(1, 'minutes'))
  }) {
    return Promise.all([this.updatedIds({ start, end }), this.deletedIds({ start, end })])
  }

}
