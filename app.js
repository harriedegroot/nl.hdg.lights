'use strict';

const Homey = require('homey');
const { HomeyAPI } = require('athom-api');

// Services
const Log = require("./Log.js");

//const DEBUG = process.env.DEBUG === '1';
//if (DEBUG) {
//    require('inspector').open(9229, '0.0.0.0', false);
//}

class LightsManager extends Homey.App {

    async getApi() {
        if (!this._api) {
            this._api = await HomeyAPI.forCurrentHomey();
        }
        return this._api;
    }
	async onInit() {
        Log.info('Lights manager is running...');

        //this.settings = Homey.ManagerSettings.get('settings') || {};
        
    }

    async getDevices() {
        try {
            const api = await this.getApi();
            return await api.devices.getDevices();
        } catch (e) {
            Log.error(e);
        }
    }

    async getZones() {
        try {
            const api = await this.getApi();
            return await api.zones.getZones();
        } catch (e) {
            Log.error(e);
        }
    }

    async settingsChanged() {
        Log.info("Settings changed");
        //this.settings = Homey.ManagerSettings.get('settings') || {};
        //Log.debug(this.settings);
    }

    async setCapabilityValue(deviceId, capabilityId, value) {
        if (typeof value === 'string') {
            if (value === 'true') value = true;
            if (value === 'false') value = false;
            value = Number(value);
        }
        const state = { deviceId, capabilityId, value };
        Log.debug("set " + capabilityId + ": " + JSON.stringify(state));
        const api = await this.getApi();
        await api.devices.setCapabilityValue(state);
    }
}

module.exports = LightsManager;