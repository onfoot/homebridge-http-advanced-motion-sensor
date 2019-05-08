var Service;
var Characteristic;
var HomebridgeAPI;
var http = require('http');
var URL = require('url');

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    HomebridgeAPI = homebridge;

    homebridge.registerAccessory("homebridge-http-advanced-motion-sensor", "http-advanced-motion-sensor", HTTPMotionSensor);
};


function HTTPMotionSensor(log, config) {
    this.log = log;
    this.name = config.name;
    this.port = config.port;
    this.fault = Characteristic.StatusFault.NO_FAULT;
    this.motionDetected = false;
    this.tampered = Characteristic.StatusTampered.NOT_TAMPERED;

    this.checkinTimeout = 90 * 1000;

    this.motionTimeout = null;
    this.tamperTimeout = null;

    var that = this;
    this.server = http.createServer(function(request, response) {
        that.httpHandler(that, request);
        response.end('Successfully requested: ' + request.url);
    });

    // info service
    this.informationService = new Service.AccessoryInformation();
        
    this.informationService
        .setCharacteristic(Characteristic.Manufacturer, "PIR Manufacturer")
        .setCharacteristic(Characteristic.Model, config.model || "HC-SR501")
        .setCharacteristic(Characteristic.SerialNumber, config.serial || "2BD53931-D4A9-4850-8E7D-8A51A842FA29");

    this.service = new Service.MotionSensor(this.name);

    this.service.getCharacteristic(Characteristic.MotionDetected)
        .on('get', (callback) => { return this.getMotionState(callback) });

    this.service.getCharacteristic(Characteristic.StatusTampered)
        .on('get', (callback) => { return this.getTamperState(callback) });

    this.service.getCharacteristic(Characteristic.StatusFault)
        .on('get', (callback) => { return this.getFaultState(callback) });

    this.server.listen(this.port, function() {
        that.log("Motion sensor server listening on: http://<your ip goes here>:%s", that.port);
    });

    this.resetFaultTimer();
}

HTTPMotionSensor.prototype.resetFaultTimer = function() {

	if (this.faultTimer) {
		clearTimeout(this.faultTimer);

		if (this.fault === Characteristic.StatusFault.GENERAL_FAULT) {
			this.log("Resetting fault.");
			this.service.updateCharacteristic(Characteristic.StatusFault, Characteristic.StatusFault.NO_FAULT);
		}
	}

	this.fault = Characteristic.StatusFault.NO_FAULT;

	this.faultTimer = setTimeout(() => {
		this.log("No sensor check in recently. Setting fault.");
		this.fault = Characteristic.StatusFault.GENERAL_FAULT;
		this.service.updateCharacteristic(Characteristic.StatusFault, this.fault);
	 }, this.checkinTimeout);
}

HTTPMotionSensor.prototype.getMotionState = function(callback) {
    callback(null, this.motionDetected);
};

HTTPMotionSensor.prototype.getTamperState = function(callback) {
    callback(null, this.tampered);
};

HTTPMotionSensor.prototype.getFaultState = function(callback) {
    callback(null, this.fault);
};

HTTPMotionSensor.prototype.httpHandler = function(that, request) {
    let url = URL.parse(request.url);

    switch (url.pathname) {
    	case '/motion':
    	that.resetFaultTimer();
    	that.log('Motion detected');
	    that.motionDetected = true;
		that.service.updateCharacteristic(Characteristic.MotionDetected, that.motionDetected);

	    if (that.motionTimer) {
	    	clearTimeout(that.motionTimer);
	    }

	    that.motionTimer = setTimeout(function() {
	    	that.log('Motion trigger off');
	        that.motionDetected = false;
	        that.service.updateCharacteristic(Characteristic.MotionDetected, that.motionDetected);
	        that.motionTimer = null;
	    }, 11 * 1000);
		break;

		case '/tamper':
		that.resetFaultTimer();
		that.log('Tamper detected');
    	that.tampered = Characteristic.StatusTampered.TAMPERED;
    	that.service.updateCharacteristic(Characteristic.StatusTampered, that.tampered);

	    if (that.tamperTimer) clearTimeout(that.tamperTimer);

	    that.tamperTimer = setTimeout(function() {
	    	that.log('Tamper trigger off');
	        that.tampered = Characteristic.StatusTampered.NOT_TAMPERED;
	        that.service.updateCharacteristic(Characteristic.StatusTampered, that.tampered);
	        that.tamperTimer = null;
	    }, 30 * 1000);
	    break;

	    case '/ping':
	    that.resetFaultTimer();
	    break;
	}
};

HTTPMotionSensor.prototype.getServices = function() {
    return [this.informationService, this.service];
};
