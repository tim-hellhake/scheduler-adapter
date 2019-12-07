/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

import { Adapter, Device, Property } from 'gateway-addon';
import { DateTime } from 'luxon';
import { load, Period } from './config';

const dayOfWeekToWeekDay: { [key: string]: number } = {
    "Monday": 1,
    "Tuesday": 2,
    "Wednesday": 3,
    "Thursday": 4,
    "Friday": 5,
    "Saturday": 6,
    "Sunday": 7
}

class SchedulerDevice extends Device {
    private activeProperty: Property;

    constructor(adapter: any, id: string, name: string, private periods: Period[], private debug: boolean, private timezone: string) {
        super(adapter, id);
        this['@context'] = 'https://iot.mozilla.org/schemas/';
        this.name = name;
        this.activeProperty = this.createProperty({
            type: 'boolean',
            title: 'active',
            description: 'Whether the schedule is active',
            readOnly: true
        });

        this.checkNow();

        setInterval(() => {
            this.checkNow();
        }, 15 * 1000);
    }

    private debugLog(log: string) {
        if (this.debug) {
            console.log(log);
        }
    }

    private checkNow() {
        const now = DateTime.local().setZone(this.timezone);
        this.debugLog(`Checking schedule for ${now.toString()}`);
        const active = this.check(now);
        this.debugLog(`Schedule is ${active}`);
        this.activeProperty.setCachedValue(active);
        this.notifyPropertyChanged(this.activeProperty);
    }

    private check(dateTime: DateTime) {
        for (const period of this.periods) {
            if (this.checkPeriod(dateTime, period)) {
                this.debugLog(`Period ${period.dayOfWeek} ${period.begin} ${period.end} is active`);
                return true;
            }
        }

        return false;
    }

    private checkPeriod(dateTime: DateTime, period: Period) {
        const {
            dayOfWeek,
            begin,
            end
        } = period;

        this.debugLog(`Checking period ${period.dayOfWeek} ${period.begin} ${period.end}`);

        const dayOfWeekNr = dayOfWeekToWeekDay[dayOfWeek];

        if (dateTime.weekday == dayOfWeekNr) {
            const totalSecondsNow = this.totalSecondsFromDate(dateTime);
            const beginSeconds = this.totalSecondsFromString(begin);
            const endSeconds = this.totalSecondsFromString(end);

            if (beginSeconds <= totalSecondsNow) {
                if (totalSecondsNow < endSeconds) {
                    return true;
                } else {
                    this.debugLog(`End ${endSeconds} <= ${totalSecondsNow}`);
                }
            } else {
                this.debugLog(`Begin ${totalSecondsNow} < ${beginSeconds}`);
            }
        } else {
            this.debugLog(`Day of week ${dateTime.weekday} != ${dayOfWeekNr}`);
        }

        return false;
    }

    private totalSecondsFromString(time: string): number {
        const [hours, minutes] = time.split(':');

        return parseInt(hours) * 60 + parseInt(minutes);
    }

    private totalSecondsFromDate(time: DateTime): number {
        return time.hour * 60 + time.minute;
    }

    createProperty(description: any) {
        const property = new Property(this, description.title, description);
        this.properties.set(description.title, property);
        return property;
    }
}

export class SchedulerAdapter extends Adapter {
    constructor(addonManager: any, manifest: any) {
        super(addonManager, SchedulerAdapter.name, manifest.name);
        addonManager.addAdapter(this);
        this.createSchedulerJobs(manifest);
    }

    private async createSchedulerJobs(manifest: any) {
        const {
            debug,
            timezone,
            schedules
        } = await load(manifest);

        if (schedules) {
            for (const schedule of schedules) {
                const {
                    id,
                    name,
                    periods
                } = schedule;
                const device = new SchedulerDevice(this, id, name, periods, debug, timezone);
                this.handleDeviceAdded(device);
            }
        }
    }
}
