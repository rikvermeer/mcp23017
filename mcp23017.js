
const i2c = require('i2c-bus');

/*
    The MCP23017 chip is split into two 8-bit ports.  port 0 controls pins
    1 to 8 while port 1 controls pins 9 to 16.
    When writing to or reading from a port the least significant bit
    represents the lowest numbered pin on the selected port.
    
    */

// Define registers values from datasheet
const registers = {
	IODIRA: 0x00, // IO direction A - 1= input 0 = output
	IODIRB: 0x01, // IO direction B - 1= input 0 = output

	// Input polarity A - If a bit is set, the corresponding GPIO register bit
	// will reflect the inverted value on the pin.
	IPOLA: 0x02,
	// Input polarity B - If a bit is set, the corresponding GPIO register bit
	// will reflect the inverted value on the pin.
	IPOLB: 0x03,

	// The GPINTEN register controls the interrupt-onchange feature for each
	// pin on port A.
	GPINTENA: 0x04,
	// The GPINTEN register controls the interrupt-onchange feature for each
	// pin on port B.
	GPINTENB: 0x05,

	// Default value for port A - These bits set the compare value for pins
	// configured for interrupt-on-change.  If the associated pin level is the
	// opposite from the register bit, an interrupt occurs.
	DEFVALA: 0x06,
	// Default value for port B - These bits set the compare value for pins
	// configured for interrupt-on-change.  If the associated pin level is the
	// opposite from the register bit, an interrupt occurs.
	DEFVALB: 0x07,

	// Interrupt control register for port A.  If 1 interrupt is fired when the
	// pin matches the default value, if 0 the interrupt is fired on state
	// change
	INTCONA: 0x08,
	// Interrupt control register for port B.  If 1 interrupt is fired when the
	// pin matches the default value, if 0 the interrupt is fired on state
	// change
	INTCONB: 0x09,

	IOCON: 0x0A,  // see datasheet for configuration register
	GPPUA: 0x0C,  // pull-up resistors for port A
	GPPUB: 0x0D,  // pull-up resistors for port B
	// The INTF register reflects the interrupt condition on the port A pins of
	// any pin that is enabled for interrupts. A set bit indicates that the
	// associated pin caused the interrupt.
	INTFA: 0x0E,
	// The INTF register reflects the interrupt condition on the port B pins of
	// any pin that is enabled for interrupts.  A set bit indicates that the
	// associated pin caused the interrupt.
	INTFB: 0x0F,
	// The INTCAP register captures the GPIO port A value at the time the
	// interrupt occurred.
	INTCAPA: 0x10,
	// The INTCAP register captures the GPIO port B value at the time the
	// interrupt occurred.
	INTCAPB: 0x11,
	GPIOA: 0x12,  // data port A
	GPIOB: 0x13, // data port B
	OLATA: 0x14,  // output latches A
	OLATB: 0x15  // output latches B
};

const IOPi = function(smbus, address) {
	this.config = {
		// create a byte array for each port
		// index: 0 = Direction, 1 = value, 2 = pullup, 3 = polarity
		port_a_direction: 0x00,
		port_b_direction: 0x00,
		port_a_value: 0x00,
		port_b_value: 0x00,
		port_a_pullup: 0x00,
		port_b_pullup: 0x00,
		port_a_polarity: 0x00,
		port_b_polarity: 0x00,

		inta: 0x00, // interrupt control for port a
		intb: 0x00, // interrupt control for port b

		ioaddress: 0x20, // I2C address
		// initial configuration - see IOCON page in the MCP23017 datasheet for
		// more information.
		ioconfig: 0x22,
	};

	this.bus = i2c.openSync(smbus);
	this.config.ioaddress = address || 0x20;

	//Write default config
	this.bus.writeByteSync(this.config.ioaddress, registers.IOCON, this.config.ioconfig);

	//Read port a, b
	

	this.config.port_a_direction = this.bus.readByteSync(this.config.ioaddress, registers.IODIRA);
	this.config.port_b_direction = this.bus.readByteSync(this.config.ioaddress, registers.IODIRB);
	
	this.config.port_a_value = this.bus.readByteSync(this.config.ioaddress, registers.GPIOA);
	this.config.port_b_value = this.bus.readByteSync(this.config.ioaddress, registers.GPIOB);

	this.config.port_a_pullup = this.bus.readByteSync(this.config.ioaddress, registers.GPPUA);
	this.config.port_b_pullup = this.bus.readByteSync(this.config.ioaddress, registers.GPPUB);

	this.config.port_a_polarity = this.bus.readByteSync(this.config.ioaddress, registers.IPOLA);
	this.config.port_b_polarity = this.bus.readByteSync(this.config.ioaddress, registers.IPOLB);
	//Set the ports to input? mode
	//this.bus.writeByteSync(this.config.ioaddress, registers.IODIRA, 0xFF);
    //this.bus.writeByteSync(this.config.ioaddress, registers.IODIRB, 0xFF);
    
    //this.setPortPullups(0, 0x00);
    //this.setPortPullups(1, 0x00);
    
    //this.invertPort(0, 0x00);
    //this.invertPort(1, 0x00);
}


/**
	internal method for reading the value of a single bit
        within a byte
**/
IOPi.prototype.checkBit = function(byte, bit) {
	let value = 0;
	if(byte & (1 << bit)) {
		value = 1;
	}
	return value;
}

/**
	internal method for setting the value of a single bit within a byte
**/
IOPi.prototype.updateByte = function(byte, bit, value) {
	if(value == 0) {
    	return byte & ~(1 << bit);
    } else if(value == 1) {
    	return byte | (1 << bit);
    }
}

/**
set IO direction for an individual pin
         pins 0 to 15
         direction 1 = input, 0 = output
**/
IOPi.prototype.setPinDirection = function(pin, direction) {
	if(pin < 8) {
		this.config.port_a_direction = this.updateByte(this.config.port_a_direction, pin, direction);
		this.bus.writeByteSync(this.config.ioaddress, registers.IODIRA, this.config.port_a_direction);
	} else {
		this.config.port_b_direction = this.updateByte(this.config.port_b_direction, pin - 8, direction);
		this.bus.writeByteSync(this.config.ioaddress, registers.IODIRB, this.config.port_b_direction);
	}
}

/**
set direction for an IO port
        port 0 = pins 0 to 7, port 1 = pins 8 to 15
        1 = input, 0 = output
**/
IOPi.prototype.setPortDirection = function(port, direction) {
	if(port == 0) {
		this.bus.writeByteSync(this.config.ioaddress, registers.IODIRA, direction);
		this.config.port_a_direction = direction;
	} else {
		this.bus.writeByteSync(this.config.ioaddress, registers.IODIRB, direction);
		this.config.port_b_direction = direction;
	}
}

/**
set the internal 100K pull-up resistors for an individual pin
        pins 1 to 16
        value 1 = enabled, 0 = disabled
**/
IOPi.prototype.setPinPullup = function(pin, value) {
	if(pin < 8) {
		this.config.port_a_pullup = this.updateByte(this.config.port_a_pullup, pin, value);
		this.bus.writeByteSync(this.config.ioaddress, registers.GPPUA, this.config.port_a_pullup);
	} else {
		this.config.port_b_pullup = this.updateByte(this.config.port_a_pullup, pin, value);
		this.bus.writeByteSync(this.config.ioaddress, registers.GPPUB, this.config.port_b_pullup);
	}
}

/**
set the internal 100K pull-up resistors for the selected IO port
**/
IOPi.prototype.setPortPullups = function(port, value) {
	if(port == 0) {
		this.config.port_a_pullup = value;
        this.bus.writeByteSync(this.config.ioaddress, registers.GPPUA, value);
	} else {
		this.config.port_b_pullup = value;
        this.bus.writeByteSync(this.config.ioaddress, registers.GPPUB, value);
	}
}

/** write to an individual pin **/
IOPi.prototype.writePin = function(pin, value) {
	if(pin < 8) {
        this.config.port_a_value = this.updateByte(this.config.port_a_value, pin, value);
        this.bus.writeByteSync(this.config.ioaddress, registers.GPIOA, this.config.port_a_value);
    } else {
        pin = pin - 8
        this.config.port_b_value = this.updateByte(this.config.port_b_value, pin, value);
        this.bus.writeByteSync(this.config.ioaddress, registers.GPIOB, this.config.port_b_value);
    }
}

/**
write to all pins on the selected port
        port 0 = pins 0) to 7, port 1 = pins 8 to 15
        value = number between 0 and 255 or 0x00 and 0xFF
**/
IOPi.prototype.writePort = function(port, value) {
	if(port == 0) {
		this.bus.writeByteSync(this.config.ioaddress, registers.GPIOA, value);
        this.config.port_a_value = value;
	} else {
		this.bus.writeByteSync(this.config.ioaddress, registers.GPIOB, value);
        this.config.port_b_value = value;
	}
}

/**
	read the value of an individual pin 0 - 15
        returns 0 = logic level low, 1 = logic level high
**/
IOPi.prototype.readPin = function(pin) {
	let value = 0;
	if(pin < 8) {
		this.config.port_a_value = this.bus.readByteSync(this.config.ioaddress, registers.GPIOA);
        value = this.checkBit(this.config.port_a_value, pin);
	} else {
		pin = pin - 8
		this.config.port_b_value = this.bus.readByteSync(this.config.ioaddress, registers.GPIOB);
        value = this.checkBit(this.config.port_b_value, pin);
	}

	return value;
}

/**
read all pins on the selected port
        port 0 = pins 0 to 7, port 1 = pins 8 to 15
        returns number between 0 and 255 or 0x00 and 0xFF
**/
IOPi.prototype.readPort = function(port) {
	let value = 0;
	if(port == 0) {
		this.config.port_a_value = this.bus.readByteSync(this.config.ioaddress, registers.GPIOA);
        value = this.config.port_a_value;
	} else {
		this.config.port_b_value = this.bus.readByteSync(this.config.ioaddress, registers.GPIOB);
        value = this.config.port_b_value;
	}
}

/**
invert the polarity of the selected pin
        pins 0 to 15
        polarity 0 = same logic state of the input pin, 1 = inverted logic
        state of the input pin
**/
IOPi.prototype.invertPin = function(pin, polarity) {
	if(pin < 8) {
		this.config.port_a_polarity = this.updateByte(this.config.port_a_polarity, pin, polarity);
        this.bus.writeByteSync(this.config.ioaddress, registers.IPOLA, this.config.port_a_polarity);
	} else {
		this.config.port_b_polarity = this.updateByte(this.config.port_b_polarity, pin, polarity);
        this.bus.writeByteSync(this.config.ioaddress, registers.IPOLB, this.config.port_b_polarity);
	}
}

/**
Invert the polarity of the pins on a selected port
        port 0 = pins 0 to 7, port 1 = pins 8 to 15
        polarity 0 = same logic state of the input pin, 1 = inverted logic
        state of the input pin
**/
IOPi.prototype.invertPort = function(port, polarity) {
	if(port == 0) {
		this.bus.writeByteSync(this.config.ioaddress, registers.IPOLA, polarity)
        this.config.port_a_polarity = polarity
	} else {
		this.bus.writeByteSync(this.config.ioaddress, registers.IPOLB, polarity)
        this.config.port_b_polarity = polarity
	}
}

/**
	0 = The INT pins are not connected.
	1 = The INT pins are internally connected,  
	__inta is associated with PortA and __intb is associated with PortB
**/
IOPi.prototype.mirrorInterrupts = function(value) {
	if(value == 0) {
		this.config.ioconfig = this.updateByte(this.config.ioconfig, 6, 0);
		this.bus.writeByteSync(this.config.ioaddress, registers.IOCON, this.config.ioconfig);
	} else {
		this.config.ioconfig = this.updateByte(this.config.ioconfig, 6, 1);
		this.bus.writeByteSync(this.config.ioaddress, registers.IOCON, this.config.ioconfig);
	}
}

/**
	This sets the polarity of the INT output pins
        1 = Active-high.
        0 = Active-low.
**/
IOPi.prototype.setInterruptPolarity = function(value) {
	if(value == 0) {
		this.config.ioconfig = this.updateByte(this.config.ioconfig, 1, 0);
		this.bus.writeByteSync(this.config.ioaddress, registers.IOCON, this.condig.ioconfig);
	} else {
		this.config.ioconfig = this.updateByte(this.condig.ioconfig, 1, 1);
		this.bus.writeByteSync(this.condig.ioaddress, registers.IOCON, this.config.ioconfig);
	}
}


/**
Sets the type of interrupt for each pin on the selected port
        1 = interrupt is fired when the pin matches the default value, 0 =
        the interrupt is fired on state change
**/
IOPi.prototype.setInterruptType = function(port, value) {
	if(port == 0) {
		this.bus.writeByteSync(this.config.ioaddress, registers.INTCONA, value);
	} else {
		this.bus.writeByteSync(this.config.ioaddress, registers.INTCONB, value);
	}
}

/**
These bits set the compare value for pins configured for
        interrupt-on-change on the selected port.
        If the associated pin level is the opposite from the register bit, an
        interrupt occurs.
**/
IOPi.prototype.setInterruptDefaults = function(port, value) {
	if(port == 0) {
		this.bus.writeByteSync(this.config.ioaddress, registers.DEFVALA, value);
	} else {
		this.bus.writeByteSync(this.config.ioaddress, registers.DEFVALB, value);
	}
}

/**
Enable interrupts for the pins on the selected port
        port 0 = pins 0 to 7, port 1 = pins 8 to 15
        value = number between 0 and 255 or 0x00 and 0xFF
**/
IOPi.prototype.setInterruptOnPort = function(port, value) {
	if(port == 0) {
		this.bus.writeByteSync(this.config.ioaddress, registers.GPINTENA, value);
		this.config.inta = value
	} else {
		this.bus.writeByteSync(this.config.ioaddress, registers.GPINTENB, value);
		this.config.intb = value
	}
}

/**
Enable interrupts for the selected pin
        Pin = 0 to 15
        Value 0 = interrupt disabled, 1 = interrupt enabled
**/
IOPi.prototype.setInterruptOnPin = function(pin, value) {
	if(pin < 8) {
		this.config.inta = this.updateByte(this.config.inta, pin, value);
		this.bus.writeByteSync(this.config.ioaddress, registers.GPINTENA, this.config.inta);
	} else {
		this.config.intb = this.updateByte(this.config.intb, pin, value);
		this.bus.writeByteSync(this.config.ioaddress, registers.GPINTENB, this.config.intb);
	}
}


/**
read the interrupt status for the pins on the selected port
        port 0 = pins 0 to 7, port 1 = pins 8 to 15
**/
IOPi.prototype.readInterruptStatus = function(port) {
	let value = 0;
	if(port == 0) {
		value = this.bus.readByteSync(this.config.ioaddress, registers.INTFA);
	} else {
		value = this.bus.readByteSync(this.config.ioaddress, registers.INTFB);
	}
	return value;
}

/**
read the value from the selected port at the time of the last
        interrupt trigger
        port 0 = pins 0 to 7, port 1 = pins 8 to 15
**/
IOPi.prototype.readInterruptCapture = function(port) {
	let value = 0;
	if(port == 0) {
		value = this.bus.readByteSync(this.config.ioaddress, registers.INTCAPA);
	} else {
		value = this.bus.readByteSync(this.config.ioaddress, registers.INTCAPB);
	}
	return value;	
}

/**
Reset the interrupts A and B to 0
**/
IOPi.prototype.resetInterrupts = function() {
	let val1 = this.readInterruptCapture(0);
	let val2 = this.readInterruptCapture(1);
	return val1, val2
}


module.exports = IOPi