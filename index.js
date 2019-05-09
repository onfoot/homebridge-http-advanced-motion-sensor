'use strict';

const http = require('http');
const urllib = require('url');

var Accessory, Service, Characteristic, UUIDGen;

module.exports = function(homebridge) {
    Accessory = homebridge.platformAccessory;
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;

    homebridge.registerAccessory('homebridge-http-advanced-motion-sensor', 'http-advanced-motion-sensor', MotionSensor);
};

class MotionSensor {

	constructor (log, config) {
		this.log = log;
		this.name = config.name;
		this.notificationPort = config.port;
		this.fault = Characteristic.StatusFault.NO_FAULT;
		this.motionDetected = false;
		this.tampered = Characteristic.StatusTampered.NOT_TAMPERED;

		this.checkinTimeout = 90 * 1000;

		this.motionTimeout = 11 * 1000;
		this.tamperTimeout = 30 * 1000;

		this.server = http.createServer((req, res) => {
			this.serverHandler(req, res);
		});

		// info service
		this.informationService = new Service.AccessoryInformation();
		this.informationService
			.setCharacteristic(Characteristic.Manufacturer, "PIR Manufacturer")
			.setCharacteristic(Characteristic.Model, config.model || "HC-SR501")
			.setCharacteristic(Characteristic.SerialNumber, config.serial || "2BD53931-D4A9-4850-8E7D-8A51A842FA29");

		this.motionService = new Service.MotionSensor(this.name);
		this.motionService.getCharacteristic(Characteristic.MotionDetected)
			.on('get', (callback) => { return this.getMotionState(callback) });

		this.motionService.getCharacteristic(Characteristic.StatusTampered)
			.on('get', (callback) => { return this.getTamperState(callback) });

		this.motionService.getCharacteristic(Characteristic.StatusFault)
			.on('get', (callback) => { return this.getFaultState(callback) });

		this.server.listen(this.notificationPort, () => {
			this.log.info("Motion sensor server listening on: http://<your ip goes here>:%s", this.notificationPort);
		});

		this.resetFaultTimer();
	}

	resetFaultTimer () {
		if (this.faultTimer) {
			clearTimeout(this.faultTimer);

			if (this.fault === Characteristic.StatusFault.GENERAL_FAULT) {
				this.log.debug("Resetting fault.");
				this.motionService.updateCharacteristic(Characteristic.StatusFault, Characteristic.StatusFault.NO_FAULT);
			}
		}

		this.fault = Characteristic.StatusFault.NO_FAULT;

		this.faultTimer = setTimeout(() => {
			this.log.debug("No sensor check in recently. Setting fault.");
			this.fault = Characteristic.StatusFault.GENERAL_FAULT;
			this.motionService.updateCharacteristic(Characteristic.StatusFault, this.fault);
		}, this.checkinTimeout);
	}

	getMotionState (callback) {
    	callback(null, this.motionDetected);
	}

	getTamperState (callback) {
    	callback(null, this.tampered);
	}

	getFaultState (callback) {
    	callback(null, this.fault);
	}

	serverHandler (req, res) {
		let url = new urllib.URL(req.url, `http://localhost:${this.notificationPort}`);

		switch (url.pathname) {
			case '/motion':
				this.resetFaultTimer();
				this.log.debug('Motion detected');
				this.motionDetected = true;
				this.motionService.updateCharacteristic(Characteristic.MotionDetected, this.motionDetected);

				if (this.motionTimer) {
					clearTimeout(this.motionTimer);
				}

				this.motionTimer = setTimeout(() => {
					this.log.debug('Motion trigger off');
					this.motionDetected = false;
					this.motionService.updateCharacteristic(Characteristic.MotionDetected, this.motionDetected);
					this.motionTimer = null;
				}, this.motionTimeout);
				res.writeHead(204);
				res.end();
				return;

			case '/tamper':
				this.resetFaultTimer();
				this.log.debug('Tamper detected');
				this.tampered = Characteristic.StatusTampered.TAMPERED;
				this.motionService.updateCharacteristic(Characteristic.StatusTampered, this.tampered);

				if (this.tamperTimer) {
					clearTimeout(this.tamperTimer);
				}

				this.tamperTimer = setTimeout(() => {
					this.log.debug('Tamper trigger off');
					this.tampered = Characteristic.StatusTampered.NOT_TAMPERED;
					this.motionService.updateCharacteristic(Characteristic.StatusTampered, this.tampered);
					this.tamperTimer = null;
				}, this.tamperTimeout);

				res.writeHead(204);
				res.end();
				return;
			case '/ping':
				this.resetFaultTimer();
				res.writeHead(204);
				res.end();
				return;
		}

		res.writeHead(404);
		res.end(JSON.stringify({'error': 'not found'}));
	};

	getServices () {
    	return [this.informationService, this.motionService];
	}
}
