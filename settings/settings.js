const REFRESH_INTERVAL = 1000;

var language = 'en';
var loading = true;
var lightSettings = {};
var $app;
var refreshInterval;
var updateValuesTimeout;

const defaultSettings = {
};

const DEFAULT_ZONE = {
    id: 'default',
    name: ''
};

//////////////////////////  DEBUG  //////////////////////////////////////
if (!window.Homey) {
    $(document).ready(function () {
        onHomeyReady({
            ready: () => { },
            get: (_, callback) => callback(null, defaultSettings),
            api: (method, url, _, callback) => {
                switch (url) {
                    case '/devices':
                        return setTimeout(() => callback(null, testDevices), 100);
                    case '/zones':
                        return setTimeout(() => callback(null, testZones), 100);
                    default:
                        return callback(null, {});
                }
            },
            getLanguage: () => 'en',
            set: () => 'settings saved',
            alert: () => alert(...arguments)
        })
    });
}
////////////////////////////////////////////////////////////////

function sortByName(a, b) {
    let name1 = a.name.trim().toLowerCase();
    let name2 = b.name.trim().toLowerCase();
    return name1 < name2 ? -1 : name1 > name2 ? 1 : 0;
}

function onHomeyReady(homeyReady){
    Homey = homeyReady;
    
    lightSettings = defaultSettings;
    if (!lightSettings.devices) {
        lightSettings.devices = {};
    }

    getLanguage();

    $app = new Vue({
        el: '#app',
        data: {
            search: '',
            allDevices: null,
            devices: null,
            zones: null,
            zonesList: [],
            config: false
        },
        methods: {
            hasName(entity, name) {
                return entity && name && (entity.name || '').toLowerCase().indexOf(name) !== -1;
            },
            clearFilter() {
                $('#search').val('');
                this.search = '';
                this.filter();
            },
            applyFilter(devices) {
                if (!devices) return [];
                if (!this.search) return devices;
                return devices.filter(d => this.hasName(d, this.search) || this.hasName(this.zones[d.zone], this.search));
            },
            filter() {
                if (this.allDevices) {
                    this.search = ($('#search').val() || '').toLowerCase();
                    this.devices = this.applyFilter(this.allDevices); 
                    this.updateZonesList();
                    setTimeout(() => {
                        this.updateValues(this.devices);
                        this.updateSliders();
                    });
                }
            },
            getZones() {
                return Homey.api('GET', '/zones', null, (err, result) => {
                    if (err) return Homey.alert(err);

                    this.zones = result || {};
                    this.updateZonesList();
                });
            },
            updateZonesList() {
                const zones = this.zones || {};
                this.zonesList = Object.keys(zones)
                    .filter(key => zones.hasOwnProperty(key))
                    .map(key => zones[key])
                    .filter(z => this.getDevicesForZone(z.id).length);
                this.zonesList.sort(sortByName);

                if (this.getDevicesForZone(DEFAULT_ZONE.id).length) {
                    this.zonesList.unshift(DEFAULT_ZONE);
                }
            },
            isLight(device) {
                try {
                    if (device && device.name) {
                        if (!device.capabilitiesObj) return false; // invalid device

                        return device.class === 'light'
                            || device.class === 'socket'
                            || !!device.capabilitiesObj.dim; // dimmable device
                    }
                    return false;
                } catch (e) {
                    return false;
                }
            },
            getDevices() {
                let interval = refreshInterval;
                return Homey.api('GET', '/devices', null, (err, result) => {
                    try {
                        loading = false;
                        if (err) {
                            //return Homey.alert(err);
                            return; // nothing...
                        }

                        const devices = Object.keys(result || {})
                            .filter(key => result.hasOwnProperty(key))
                            .map(key => result[key])
                            .filter(d => this.isLight(d));

                        //devices.sort((d1, d2) => (d1.name || '').toLowerCase() > (d2.name || '').toLowerCase());
                        devices.sort(sortByName);
                        devices.filter(d => !d.zone).forEach(d => d.zone = DEFAULT_ZONE.id);
                        
                        if (!this.allDevices) {
                            this.allDevices = devices;
                            this.filter();
                            document.getElementById('devices-list').style.display = 'block';
                        }

                        if (interval === refreshInterval) { // NOTE: Skip when interval is cleared or another update is triggered
                            updateValuesTimeout = setTimeout(() => this.updateValues(devices));
                        }
                        
                    } catch (e) {
                        // nothing
                    }
                });
            },
            updateValues(devices) {
                for (let zone of this.zonesList) {
                    $('#zone-switch_' + zone.id).prop("checked", false);
                }
                devices = this.applyFilter(devices).filter(d => lightSettings.devices[d.id] !== false);
                for (let device of devices) {
                    try {
                        if (device.capabilitiesObj) {
                            
                            if (device.capabilitiesObj.hasOwnProperty('onoff')) {
                                const value = !!device.capabilitiesObj.onoff.value;
                                $('#switch_' + device.id).prop("checked", value);

                                if (value) {
                                    $('#zone-switch_' + device.zone).prop("checked", true);
                                }
                            }
                            if (device.capabilitiesObj.hasOwnProperty('dim')) {
                                const value = this.getBrightness(device);
                                $('#dim_' + device.id).val(value).change();
                            }
                        }
                    } catch (e) {
                        // nothing
                    }
                }
            },
            getZone: function (device) {
                if (device) {
                    const zoneId = device.zone && typeof device.zone === 'object' ? device.zone.id : device.zone;
                    const zone = this.zones && this.zones[zoneId];
                    return zone && zone.name ? zone.name : '';
                }
                return '';
            },
            getIcon: function (device) {
                try {
                    if (device && device.iconObj && device.iconObj.url)
                        return "<img src=\"" + device.iconObj.url + "\" style=\"width:auto;height:auto;max-width:50px;max-height:30px;\"/>";
                } catch (e) {
                    // nothing
                }
                return "<!-- no device.iconObj.url -->";
            },
            switchLight(device, checked) {
                try {
                    if (!device || typeof device !== 'object' || !device.id)
                        return;

                    this.setCapabilityValue(device.id, 'onoff', checked);

                } catch (e) {
                    Homey.alert('Failed to switch the light');
                }
            },
            //zoneOn(zone) {
            //    return !this.getDevicesForZone(zone.id).some(d => !this.deviceOn(d));
            //},
            switchZone(zone, checked) {
                try {
                    if (!zone || typeof zone !== 'object' || !zone.id)
                        return;

                    const devices = this.getDevicesForZone(zone.id);
                    devices.forEach(d => {
                        this.setCapabilityValue(d.id, 'onoff', checked);
                        $('#switch_' + d.id).prop("checked", checked);
                    });

                } catch (e) {
                    Homey.alert('Failed to switch the light');
                }
            },
            setCapabilityValue(deviceId, capabilityId, value) {
                this.clearRefreshInterval();
                const device = this.getDevice(deviceId);
                if (device && device.capabilitiesObj) {
                    const c = device.capabilitiesObj[capabilityId];
                    if (c) {
                        c.value = value;
                    }
                }
                setTimeout(() => this.updateValues(this.devices), 0);

                return Homey.api(
                    'POST', 
                    '/capability',
                    { deviceId, capabilityId, value },
                    (err, result) => {
                        this.setRefreshInterval();
                        if (err) return Homey.alert(err);
                    }
                );
            },
            getDevice(deviceId) {
                return this.devices.find(d => d.id === deviceId);
            },
            deviceOn(device) {
                try {
                    return device && device.capabilitiesObj && device.capabilitiesObj.onoff && device.capabilitiesObj.onoff.value === true;
                } catch (e) {
                    return false;
                }
            },
            hasBrightness: function (device) {
                try {
                    return device && device.capabilitiesObj && device.capabilitiesObj.dim;
                } catch (e) {
                    return false;
                }
            },
            getBrightness: function (device) {
                try {
                    if (device && device.capabilitiesObj && device.capabilitiesObj.dim) {
                        return device.capabilitiesObj.onoff && !device.capabilitiesObj.onoff.value
                            ? 0
                            : (device.capabilitiesObj.dim.value || 0) * 100;
                    }
                } catch (e) {
                    // nothing
                }
                return 0;
            },
            updateSliders() {
                try {
                    let sliders = $('input[type="range"]');
                    let self = this;
                    sliders.rangeslider({
                        polyfill: false,
                        onSlideEnd: function (position, value) {
                            try {
                                const deviceId = this.$element.data().id;
                                self.setCapabilityValue(deviceId, 'dim', value / 100);
                            } catch (e) {
                                Homey.alert("Failed to update brightness");
                            }
                        }
                    });
                } catch (e) {
                    // nothing
                }
            },
            clearRefreshInterval() {
                if (updateValuesTimeout) {
                    clearTimeout(updateValuesTimeout);
                    updateValuesTimeout = undefined;
                }
                if (refreshInterval) {
                    clearInterval(refreshInterval);
                    refreshInterval = undefined;
                }
            },
            setRefreshInterval() {
                this.clearRefreshInterval();
                refreshInterval = setInterval(() => this.getDevices(), REFRESH_INTERVAL);
            },
            getDevicesForZone(zoneId) {
                const devices = this.devices ? this.devices.filter(d => d.zone === zoneId) : [];
                return this.config ? devices : devices.filter(d => lightSettings.devices[d.id] !== false);
            },
            toggleConfig() {
                this.config = !this.config;
                this.updateZonesList();
                this.redraw();
            },
            toggleDevice(deviceId) {
                
                // toggle
                lightSettings.devices[deviceId] = lightSettings.devices.hasOwnProperty(deviceId)
                    ? !lightSettings.devices[deviceId]
                    : false;
                
                saveSettings();
                this.redraw();
            },
            redraw() {
                setTimeout(() => {
                    $app.$forceUpdate();
                    this.updateSliders();
                },0);
            }
        },
       
        async mounted() {
            $('.app-header').show();

            await this.getZones();
            await this.getDevices();

            this.setRefreshInterval();
        },
        computed: {
            devices() { return this.devices; },
            zones() { return this.zones; }
        }
    });

    Homey.get('settings', function (err, savedSettings) {
        if (err) {
            Homey.alert(err);
        } else if (savedSettings) {
            Object.assign(lightSettings, savedSettings);
            if (!lightSettings.devices) {
                lightSettings.devices = {};
            }
        }
        $app.updateZonesList();
    });
}

function showTab(tab){
    $('.tab').removeClass('tab-active');
    $('.tab').addClass('tab-inactive');
    $('#tabb' + tab).removeClass('tab-inactive');
    $('#tabb' + tab).addClass('active');
    $('.panel').hide();
    $('#tab' + tab).show();
}

function getLanguage() {
    try {
        Homey.getLanguage(function (err, language) {
            language = language === 'nl' ? 'nl' : 'en';
            const el = document.getElementById("instructions" + language) || document.getElementById("instructionsen");
            if (el) {
                el.style.display = "inline";
            }
            Homey.ready();
        });
    } catch (e) {
        Homey.alert('Failed to get language: ' + e);
        const el = document.getElementById("instructions" + language) || document.getElementById("instructionsen");
        if (el) {
            el.style.display = "inline";
        }
        Homey.ready();
    }
}

function saveSettings() {

    //for (let key in defaultSettings) {
    //    let el = document.getElementById(key);
    //    if (el) {
    //        lightSettings[key] = typeof defaultSettings[key] === 'boolean' ? el.checked : el.value;
    //    }
    //}
    _writeSettings(lightSettings);
}

function _writeSettings(settings) {
    try {
        Homey.set('settings', settings);
        Homey.api('GET', '/settings_changed', null, (err, result) => { });
    } catch (e) {
        Homey.alert('Failed to save settings: ' + e);
    }
}
