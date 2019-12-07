/**
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.*
 */

import { Database } from "gateway-addon";
import crypto from 'crypto';

export interface Config {
    debug: boolean,
    timezone: string,
    schedules: Schedule[]
}

export interface Schedule {
    id: string,
    name: string,
    periods: Period[]
}

export interface Period {
    dayOfWeek: string,
    begin: string,
    end: string
}

export async function load(manifest: any): Promise<Config> {
    const database = new Database(manifest.name);
    await database.open();
    const config: Config = withIds(await database.loadConfig());
    await database.saveConfig(config);

    return config;
}

function withIds(config: Config): Config {
    const {
        debug,
        timezone,
        schedules
    } = config;

    return {
        debug,
        timezone,
        schedules: (schedules || []).map(withId)
    };
}

function withId<T extends { id: string, name: string }>(obj: T): T {
    const {
        id,
        name
    } = obj

    if (!id) {
        const generatedId = crypto.randomBytes(16).toString("hex");

        console.log(`Generated id ${generatedId} for ${name}`);

        return {
            ...obj,
            id: generatedId
        }
    }

    return obj;
}
