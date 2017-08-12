import RecordSubject from '../'

import {
    expect
} from 'chai'
import path from 'path'
import moment from 'moment'
import { Observable, Subject } from 'rxjs/rx'

require('dotenv').config();

class DataUtl {
    constructor({
        conn
    }) {
        this.conn = conn
    }

    updateRecord({
        objectName,
        values
    }) {
        const soql = `select Id, Name, Description from ${objectName} limit 1`
        return this.conn.query(soql)
            .then(res => res.records[0])
            .then(rec => this.conn.sobject(objectName).update(Object.assign({
                Id: rec.Id
            }, values)))
    }

    updateAccount() {
        return this.updateRecord({
            objectName: 'Account',
            values: {
                Description: `${(new Date()).getTime()} - automated description update`
            }
        })
    }

    createAccount() {
        return this.conn.sobject('Account').create({
            Name: `account ${(new Date()).getTime()}`
        })
    }

    deleteAccount(id) {
        return this.conn.sobject('Account').destroy(id)
    }

}

describe('RecordSubject', function () {

    let du = null
    let subject = null

    beforeEach(done => {
        const objectName = 'Account'
        const timeIntervalInSeconds = 5
        const lastObservationDateTime = new Date()
        subject = new RecordSubject({
            objectName,
            timeIntervalInSeconds,
            lastObservationDateTime
        })
        subject.login()
            .then(() => {
                du = new DataUtl({
                    conn: subject.conn
                })
                done()
            })
            .catch(done)
    })


    it('should login', done => {
        subject.login()
            .then(res => {
                expect(res.id).to.be.a('string')
                expect(res.id.length).to.be.above(0)
                done()
            })
            .catch(done)
    })

    it('should push udpated ids on record create', done => {
        const subscription = subject.subscribe(x => {
            expect(x.type).to.equal('update')
            expect(x.id).to.be.a('string')
            expect(x.id.length).to.be.above(0)
            done()
            subscription.unsubscribe()
        })

        Observable.timer(1000)
            .subscribe(() => du.createAccount())

    })


    it('should push udpated ids on record update', done => {
        const subscription = subject.subscribe(x => {
            expect(x.type).to.equal('update')
            expect(x.id).to.be.a('string')
            expect(x.id.length).to.be.above(0)
            done()
            subscription.unsubscribe()
        })

        Observable.timer(1000)
            .subscribe(() => du.updateAccount())

    })

    it('should push deleted ids on record delete', done => {
        const subscription = subject
            .filter(x => x.type === 'delete')
            .subscribe(x => {
                expect(x.type).to.equal('delete')
                expect(x.id).to.be.a('string')
                expect(x.id.length).to.be.above(0)
                done()
                subscription.unsubscribe()
            })

        Observable.timer(1000)
            .subscribe(() => {
                du.createAccount()
                    .then(res => du.deleteAccount(res.id))

            })

    })


    /*
    it.skip('should observe updated records', done => {


        obs.registerHandler(message => {
            obs.clearHandlers()
            expect(message.event.type).to.equal('updated')
            expect(message.event.createdDate).to.be.a('string')
            expect(message.sobject.Id).to.be.a('string')
            done()
        })

        obs.observe()
            .then(res => du.updateRecord({
                objectName: 'Account',
                values: {
                    Description: `${(new Date()).getTime()} - automated description update`
                }
            }))
            .catch(done)

    })

    it.skip('should return updated record Ids', done => {
        const start = new Date()
        obs.observe()
            .then(res => du.updateRecord({
                objectName: 'Account',
                values: {
                    Description: `${(new Date()).getTime()} - automated description update`
                }
            }))
            .then(() => {
                // add 1 min.
                // salesforce docs
                // The API ignores the seconds portion of the specified dateTime value (for example, 12:35:15 is interpreted as 12:35:00 UTC)
                const end = moment().add(1, 'minutes')
                return obs.updatedIds({
                    start,
                    end
                })
            })
            .then(res => {
                expect(res.ids.length).to.be.above(0)
                expect(res.ids[0]).to.be.a('string')
                done()
            })
            .catch(done)
    })

    it.skip('should return deleted record Ids', done => {
        const start = new Date()
        obs.login()
            .then(res => du.createAccount())
            .then(res => {
                // e.g. res { id: '001i000001sNl3uAAC', success: true, errors: [] }
                return du.deleteAccount(res.id)
            })
            .then(res => {
                // add 1 min.
                // salesforce docs
                // The API ignores the seconds portion of the specified dateTime value (for example, 12:35:15 is interpreted as 12:35:00 UTC)
                const end = moment().add(1, 'minutes')
                return obs.deletedIds({
                    start,
                    end
                })
            })
            .then(res => {
                // e.g. res
                // {
                //     deletedRecords: [{
                //         deletedDate: '2016-05-10T20:51:31.000+0000',
                //         id: '001i000001sNlE9AAK'
                //     }],
                //     earliestDateAvailable: '2013-12-08T23:25:00.000+0000',
                //     latestDateCovered: '2016-05-10T20:14:00.000+0000'
                // }
                expect(res.deletedRecords.length).to.be.above(0)
                expect(res.deletedRecords[0].id).to.be.a('string')
                done()
            })
            .catch(done);
    })

    it.skip('should return updated or deleted ids', done => {
        const start = new Date();
        du.updateAccount()
            .then(() => du.createAccount())
            .then(res => du.deleteAccount(res.id))
            .then(res => {
                // add 1 min.
                // salesforce docs
                // The API ignores the seconds portion of the specified dateTime value (for example, 12:35:15 is interpreted as 12:35:00 UTC)
                const end = moment().add(1, 'minutes')

                return obs.updatedOrDeletedIds({
                    start,
                    end
                })
            })
            .then(res => {
                expect(res.length).to.equal(2)
                expect(res[0].ids.length).to.be.above(0)
                expect(res[1].deletedRecords.length).to.be.above(0)
                done()
            })
            .catch(done)

    })
    */
})
