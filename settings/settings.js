var language = 'en';
var loading = true;
var lightSettings = {};
var $app;
var refreshInterval;

const defaultSettings = {
};

//////////////////////////  DEBUG  //////////////////////////////////////
//const testDevices = {
//    test: {
//        class: 'light',
//        id: 'test', name: "test some long named device lkfjdh sdlkfjhgsldkfhg lksdjfhslkdh ", zone: "zone", iconObj: {
//            url: "../assets/icon.svg"
//        },
//        capabilitiesObj: {
//            onoff: {
//            },
//            measure_temperature: {
//                value: 18.5,
//                setable: false
//            },
//            target_temperature: {
//                value: 21.3,
//                setable: true,
//                min: 4,
//                max: 35,
//                step: 0.5,
//                units: 'C'
//            }
//        }
//    },
//    test1: {
//        class: 'unknown',
//        id: 'test1', name: "device 1", zone: "zone 2", iconObj: {
//            url: "../assets/icon.svg"
//        },
//        capabilitiesObj: {
//            onoff: {
//            },
//            dim: {
//            },
//            measure_temperature: {
//                value: 77,
//                setable: false,
//                units: 'F'
//            },
//            target_temperature: {
//                value: 55,
//                setable: true,
//                min: -10,
//                max: 90,
//                step: 1,
//                units: 'F'
//            }
//        }
//    },
//    test2: {
//        class: 'socket',
//        id: 'test2', name: "device 2", zone: "zone 2", iconObj: {
//            url: "../assets/icon.svg"
//        },
//        capabilitiesObj: {
//            measure_temperature: {
//                value: 21.5,
//                setable: false
//            },
//            onoff: {}
//        }
//    },
//    test3: { id: 'test', name: "device 3", zone: "zone" },
//    test4: { id: 'test', name: "device 4", zone: "zone" },
//    test5: { id: 'test', name: "device 5", zone: "zone" },
//    test6: { id: 'test', name: "device 6", zone: "zone" },
//    test7: { id: 'test', name: "device 7", zone: "zone" },
//    test8: { id: 'test', name: "device 8", zone: "zone" },
//    test9: { id: 'test', name: "device 9", zone: "zone" },
//    test10: { id: 'test', name: "device 10", zone: "zone" }
//};

//$(document).ready(function () {
//    onHomeyReady({
//        ready: () => { },
//        get: (_, callback) => callback(null, defaultSettings),
//        api: (method, url, _, callback) => {
//            switch (url) {
//                case '/devices':
//                    return setTimeout(() => callback(null, testDevices), 1000);
//                case '/zones':
//                    return callback(null, { zone: { name: 'zone' } });
//                default:
//                    return callback(null, {});
//            }
//        },
//        getLanguage: () => 'en',
//        set: () => 'settings saved',
//        alert: () => alert(...arguments)
//    })
//});
////////////////////////////////////////////////////////////////

function onHomeyReady(homeyReady){
    Homey = homeyReady;
    
    lightSettings = defaultSettings;
    
    getLanguage();

    $app = new Vue({
        el: '#app',
        data: {
            devices: null,
            zones: {}
        },
        methods: {
            getZones() {
                return Homey.api('GET', '/zones', null, (err, result) => {
                    if (err) return Homey.alert(err);
                    this.zones = result;
                });
            },
            isLight(device) {
                try {
                    if (device) {
                        if (device.class === 'light' || device.class === 'socket')
                            return true;

                        if (device.capabilitiesObj)
                            return !!device.capabilitiesObj.dim;
                    }
                    return false;
                } catch (e) {
                    return false;
                }
            },
            getDevices() {
                return Homey.api('GET', '/devices', null, (err, result) => {
                    try {
                        loading = false;
                        if (err) return Homey.alert(err);

                        const devices = Object.keys(result || [])
                            .filter(key => result.hasOwnProperty(key))
                            .map(key => result[key])
                            .filter(d => this.isLight(d));

                        if (!this.devices) {
                            this.devices = devices;
                            document.getElementById('devices-list').style.display = 'block';
                            this.$nextTick(() => this.updateSliders());
                        } else {
                            this.updateValues(devices);
                        }
                    } catch (e) {
                        // nothing
                    }
                });
            },
            updateValues(devices) {
                for (let device of devices) {
                    try {
                        if (device.capabilitiesObj) {
                            if (device.capabilitiesObj.hasOwnProperty('onoff')) {
                                const el = document.getElementById('switch_' + device.id);
                                if (el) {
                                    el.checked = !!device.capabilitiesObj.onoff.value;
                                }
                            }
                            if (device.capabilitiesObj.hasOwnProperty('dim')) {
                                const value = Number(device.capabilitiesObj.dim.value) * 100;
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
            setCapabilityValue(device, capability, value) {
                this.setRefreshInterval();
                return Homey.api(
                    'POST', 
                    '/capability',
                    { device, capability, value },
                    (err, result) => {
                        this.setRefreshInterval();
                        if (err) return Homey.alert(err);
                    }
                );
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
                        return device.capabilitiesObj.dim.value * 100;
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
                                self.setCapabilityValue(this.$element.data().id, 'dim', value / 100);
                            } catch (e) {
                                Homey.alert("Failed to update brightness");
                            }
                        }
                    });
                } catch (e) {
                    // nothing
                }
            },
            setRefreshInterval() {
                if (refreshInterval) {
                    clearInterval(refreshInterval);
                    refreshInterval = undefined;
                }
                // update every xx seconds
                refreshInterval = setInterval(() => this.getDevices(), 1000);
            }
        },
       
        async mounted() {
            await this.getZones();
            await this.getDevices();

            this.setRefreshInterval();
        },
        computed: {
            devices() {
                return this.devices;
            },
            zones() {
                return this.zones;
            }
        }
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

    for (let key in defaultSettings) {
        let el = document.getElementById(key);
        if (el) {
            lightSettings[key] = typeof defaultSettings[key] === 'boolean' ? el.checked : el.value;
        }
    }
    _writeSettings();
}

function _writeSettings(settings) {
    try {
        Homey.set('settings', lightSettings);
        Homey.api('GET', '/settings_changed', null, (err, result) => { });
    } catch (e) {
        Homey.alert('Failed to save settings: ' + e);
    }
}
