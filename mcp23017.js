const i2c = require("i2c-bus");
// const i2c = {
// 	openSync: function() {
// 		return {
// 			writeByteSync: function() {},
// 			readByteSync: function() {}
// 		}
// 	}
// }

/**
 * The MCP23017 chip is split into two 8-bit ports.  port 0 controls pins
 * 1 to 8 while port 1 controls pins 9 to 16.
 * When writing to or reading from a port the least significant bit
 * represents the lowest numbered pin on the selected port.
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
	GPIOA: 0x12,  // Data port A
	GPIOB: 0x13, // Data port B
	OLATA: 0x14,  // Output latches A
	OLATB: 0x15  // Output latches B
};

const MCP23017 = function (smbus, address) {
	this.config = {
		// Create a byte array for each port
		// Index: 0 = Direction, 1 = value, 2 = pullup, 3 = polarity
		port_a_direction: 0x00,
		port_b_direction: 0x00,
		port_a_value: 0x00,
		port_b_value: 0x00,
		port_a_pullup: 0x00,
		port_b_pullup: 0x00,
		port_a_polarity: 0x00,
		port_b_polarity: 0x00,

		inta: 0x00, // Interrupt control for port a
		intb: 0x00, // Interrupt control for port b

		ioaddress: 0x20, // I2C address
		// Initial configuration - see IOCON page in the MCP23017 datasheet for more information.
		ioconfig: 0x22,
	};

	this.bus = i2c.openSync(smbus);
	this.config.ioaddress = address || 0x20;

	// Write default config
	this.bus.writeByteSync(this.config.ioaddress, registers.IOCON, this.config.ioconfig);

	// Read port a, b
	this.config.port_a_direction = this.bus.readByteSync(this.config.ioaddress, registers.IODIRA);
	this.config.port_b_direction = this.bus.readByteSync(this.config.ioaddress, registers.IODIRB);

	this.config.port_a_value = this.bus.readByteSync(this.config.ioaddress, registers.GPIOA);
	this.config.port_b_value = this.bus.readByteSync(this.config.ioaddress, registers.GPIOB);

	this.config.port_a_latch_value = this.bus.readByteSync(this.config.ioaddress, registers.OLATA);
	this.config.port_b_latch_value = this.bus.readByteSync(this.config.ioaddress, registers.OLATA);

	this.config.port_a_pullup = this.bus.readByteSync(this.config.ioaddress, registers.GPPUA);
	this.config.port_b_pullup = this.bus.readByteSync(this.config.ioaddress, registers.GPPUB);

	this.config.port_a_polarity = this.bus.readByteSync(this.config.ioaddress, registers.IPOLA);
	this.config.port_b_polarity = this.bus.readByteSync(this.config.ioaddress, registers.IPOLB);
	// Set the ports to input? mode
	// this.bus.writeByteSync(this.config.ioaddress, registers.IODIRA, 0xFF);
	// this.bus.writeByteSync(this.config.ioaddress, registers.IODIRB, 0xFF);

	// this.setPortPullups(0, 0x00);
	// this.setPortPullups(1, 0x00);

	// this.invertPort(0, 0x00);
	// this.invertPort(1, 0x00);
};

/**
 * Internal method for reading the value of a single bit within a byte
 *
 * @param byte Byte that contains the bit that will be read
 * @param bit Single bit to read
 * @returns {number} Bit
 */
MCP23017.prototype.checkBit = function (byte, bit) {
	return (byte & (1 << bit)) ? 1 : 0;
};

/**
 * Internal method for setting the value of a single bit within a byte
 *
 * @param byte Byte to change
 * @param bit Bit to change
 * @param value Value to set bit to
 * @returns {number} Byte
 */
MCP23017.prototype.updateByte = function (byte, bit, value) {
	if (value === 0) return byte & ~(1 << bit);
	else if (value === 1) return byte | (1 << bit);
};

/**
 * Set IO direction for an individual pin
 *
 * @param pin Pins 0 to 15
 * @param direction Direction where 1 = input and 0 = output
 */
MCP23017.prototype.setPinDirection = function (pin, direction) {
	if (pin < 8) {
		this.config.port_a_direction = this.updateByte(this.config.port_a_direction, pin, direction);
		this.bus.writeByteSync(this.config.ioaddress, registers.IODIRA, this.config.port_a_direction);
	} else {
		this.config.port_b_direction = this.updateByte(this.config.port_b_direction, pin - 8, direction);
		this.bus.writeByteSync(this.config.ioaddress, registers.IODIRB, this.config.port_b_direction);
	}
};

/**
 * Set direction for an IO port
 *
 * @param port Port 0 = pins 0 to 7, port 1 = pins 8 to 15
 * @param direction Directions where 1 = input and 0 = output
 */
MCP23017.prototype.setPortDirection = function (port, direction) {
	if (port === 0) {
		this.bus.writeByteSync(this.config.ioaddress, registers.IODIRA, direction);
		this.config.port_a_direction = direction;
	} else {
		this.bus.writeByteSync(this.config.ioaddress, registers.IODIRB, direction);
		this.config.port_b_direction = direction;
	}
};

/**
 * Set the internal 100K pull-up resistors for an individual pin
 *
 * @param pin Pin 0 to 15
 * @param value Value where 1 = enabled and 0 = disabled
 */
MCP23017.prototype.setPinPullup = function (pin, value) {
	if (pin < 8) {
		this.config.port_a_pullup = this.updateByte(this.config.port_a_pullup, pin, value);
		this.bus.writeByteSync(this.config.ioaddress, registers.GPPUA, this.config.port_a_pullup);
	} else {
		this.config.port_b_pullup = this.updateByte(this.config.port_a_pullup, pin - 8, value);
		this.bus.writeByteSync(this.config.ioaddress, registers.GPPUB, this.config.port_b_pullup);
	}
};

/**
 * Read/Get the pullup value of an individual pin
 *
 * @param pin Pins 0 to 15
 * @returns {number} Value of given pin, where 0 = logic level low, 1 = logic level high
 */
MCP23017.prototype.getPinPullup = function (pin) {
	if (pin < 8) {
		this.config.port_a_pullup = this.bus.readByteSync(this.config.ioaddress, registers.GPPUA);
		return this.checkBit(this.config.port_a_pullup, pin);
	} else {
		this.config.port_b_pullup = this.bus.readByteSync(this.config.ioaddress, registers.GPPUB);
		return this.checkBit(this.config.port_b_pullup, pin - 8);
	}
};

/**
 * Set the internal 100K pull-up resistors for the selected IO port
 *
 * @param port Port 0 = pins 0 to 7, port 1 = pins 8 to 15
 * @param value Value
 */
MCP23017.prototype.setPortPullups = function (port, value) {
	if (port === 0) {
		this.config.port_a_pullup = value;
		this.bus.writeByteSync(this.config.ioaddress, registers.GPPUA, value);
	} else {
		this.config.port_b_pullup = value;
		this.bus.writeByteSync(this.config.ioaddress, registers.GPPUB, value);
	}
};

/**
 * Read/Get the internal 100K pull-up resistors for the selected IO port
 *
 * @param port Port 0 = pins 0 to 7, port 1 = pins 8 to 15
 * @returns {number} Value is a number between 0 and 255 or 0x00 and 0xFF
 */
MCP23017.prototype.getPortPullups = function (port) {
	if (port === 0) {
		this.config.port_a_pullup = this.bus.readByteSync(this.config.ioaddress, registers.GPPUA);
		return this.config.port_a_pullup;
	} else {
		this.config.port_b_pullup = this.bus.readByteSync(this.config.ioaddress, registers.GPPUB);
		return this.config.port_b_pullup;
	}
};

/**
 * Write to an individual pin
 *
 * @param pin Pin to write to
 * @param value Value to write to pin
 */
MCP23017.prototype.writePin = function (pin, value) {
	if (pin < 8) {
		this.config.port_a_value = this.updateByte(this.config.port_a_value, pin, value);
		this.bus.writeByteSync(this.config.ioaddress, registers.GPIOA, this.config.port_a_value);
	} else {
		this.config.port_b_value = this.updateByte(this.config.port_b_value, pin - 8, value);
		this.bus.writeByteSync(this.config.ioaddress, registers.GPIOB, this.config.port_b_value);
	}
};

/**
 * Write to all pins on the selected port
 *
 * @param port Port 0 = pins 0 to 7, port 1 = pins 8 to 15
 * @param value Value is a number between 0 and 255 or 0x00 and 0xFF
 */
MCP23017.prototype.writePort = function (port, value) {
	if (port === 0) {
		this.bus.writeByteSync(this.config.ioaddress, registers.GPIOA, value);
		this.config.port_a_value = value;
	} else {
		this.bus.writeByteSync(this.config.ioaddress, registers.GPIOB, value);
		this.config.port_b_value = value;
	}
};

/**
 * Read the value of an individual pin
 *
 * @param pin Pins 0 to 15
 * @returns {number} Value of given pin, where 0 = logic level low, 1 = logic level high
 */
MCP23017.prototype.readPin = function (pin) {
	if (pin < 8) {
		this.config.port_a_value = this.bus.readByteSync(this.config.ioaddress, registers.GPIOA);
		return this.checkBit(this.config.port_a_value, pin);
	} else {
		this.config.port_b_value = this.bus.readByteSync(this.config.ioaddress, registers.GPIOB);
		return this.checkBit(this.config.port_b_value, pin - 8);
	}
};

/**
 * Read all pins on the selected port
 *
 * @param port Port 0 = pins 0 to 7, port 1 = pins 8 to 15
 * @returns {number} Value is a number between 0 and 255 or 0x00 and 0xFF
 */
MCP23017.prototype.readPort = function (port) {
	if (port === 0) {
		this.config.port_a_value = this.bus.readByteSync(this.config.ioaddress, registers.GPIOA);
		return this.config.port_a_value;
	} else {
		this.config.port_b_value = this.bus.readByteSync(this.config.ioaddress, registers.GPIOB);
		return this.config.port_b_value;
	}
};

/**
 * Invert the polarity of the selected pin
 *
 * @param pin Pins 0 to 15
 * @param polarity Polarity of the input pin, 0 = same logic state, 1 = inverted logic state
 */
MCP23017.prototype.invertPin = function (pin, polarity) {
	if (pin < 8) {
		this.config.port_a_polarity = this.updateByte(this.config.port_a_polarity, pin, polarity);
		this.bus.writeByteSync(this.config.ioaddress, registers.IPOLA, this.config.port_a_polarity);
	} else {
		this.config.port_b_polarity = this.updateByte(this.config.port_b_polarity, pin - 8, polarity);
		this.bus.writeByteSync(this.config.ioaddress, registers.IPOLB, this.config.port_b_polarity);
	}
};

/**
 * Invert the polarity of the pins on a selected port
 *
 * @param port Port 0 = pins 0 to 7, port 1 = pins 8 to 15
 * @param polarity Polarity of the input pin, 0 = same logic state, 1 = inverted logic state
 */
MCP23017.prototype.invertPort = function (port, polarity) {
	if (port === 0) {
		this.bus.writeByteSync(this.config.ioaddress, registers.IPOLA, polarity);
		this.config.port_a_polarity = polarity
	} else {
		this.bus.writeByteSync(this.config.ioaddress, registers.IPOLB, polarity);
		this.config.port_b_polarity = polarity
	}
};

/**
 * __inta is associated with PortA and __intb is associated with PortB
 *
 * @param value Value where 0 = The INT pins are not connected, 1 = The INT pins are internally connected,
 */
MCP23017.prototype.mirrorInterrupts = function (value) {
	if (value === 0) {
		this.config.ioconfig = this.updateByte(this.config.ioconfig, 6, 0);
		this.bus.writeByteSync(this.config.ioaddress, registers.IOCON, this.config.ioconfig);
	} else {
		this.config.ioconfig = this.updateByte(this.config.ioconfig, 6, 1);
		this.bus.writeByteSync(this.config.ioaddress, registers.IOCON, this.config.ioconfig);
	}
};

/**
 * Set the polarity of the INT output pins
 *
 * @param value Value where 1 = Active-high, 0 = Active-low
 */
MCP23017.prototype.setInterruptPolarity = function (value) {
	if (value === 0) {
		this.config.ioconfig = this.updateByte(this.config.ioconfig, 1, 0);
		this.bus.writeByteSync(this.config.ioaddress, registers.IOCON, this.config.ioconfig);
	} else {
		this.config.ioconfig = this.updateByte(this.config.ioconfig, 1, 1);
		this.bus.writeByteSync(this.config.ioaddress, registers.IOCON, this.config.ioconfig);
	}
};

/**
 * Sets the type of interrupt for each pin on the selected port
 *
 * @param port Port to change interrupt for pins
 * @param value Value where 1 = interrupt is fired when the pin matches the default value,
 * 				0 = the interrupt is fired on state change
 */
MCP23017.prototype.setInterruptType = function (port, value) {
	if (port === 0) {
		this.bus.writeByteSync(this.config.ioaddress, registers.INTCONA, value);
	} else {
		this.bus.writeByteSync(this.config.ioaddress, registers.INTCONB, value);
	}
};

/**
 * Read the output latch value of an individual pin
 *
 * @param pin Pins 0 to 15
 * @returns {number} Value of given pin, where 0 = logic level low, 1 = logic level high
 */
MCP23017.prototype.readPinOutputLatch = function (pin) {
	if (pin < 8) {
		this.config.port_a_latch_value = this.bus.readByteSync(this.config.ioaddress, registers.OLATA);
		return this.checkBit(this.config.port_a_latch_value, pin);
	} else {
		this.config.port_b_latch_value = this.bus.readByteSync(this.config.ioaddress, registers.OLATB);
		return this.checkBit(this.config.port_b_latch_value, pin - 8);
	}
};

/**
 * Read output latch value of all pins on the selected port
 *
 * @param port Port 0 = pins 0 to 7, port 1 = pins 8 to 15
 * @returns {number} Value is a number between 0 and 255 or 0x00 and 0xFF
 */
MCP23017.prototype.readPortOutputLatches = function (port) {
	if (port === 0) {
		this.config.port_a_latch_value = this.bus.readByteSync(this.config.ioaddress, registers.OLATA);
		return this.config.port_a_latch_value;
	} else {
		this.config.port_b_latch_value = this.bus.readByteSync(this.config.ioaddress, registers.OLATB);
		return this.config.port_b_latch_value;
	}
};


/**
 * These bits set the compare value for pins configured for interrupt-on-change on the
 * selected port. If the associated pin level is the opposite from the register bit,
 * an interrupt occurs.
 *
 * @param port Port to change interrupt for pins
 * @param value Compare value to set to pin interrupt
 */
MCP23017.prototype.setInterruptDefaults = function (port, value) {
	if (port === 0) {
		this.bus.writeByteSync(this.config.ioaddress, registers.DEFVALA, value);
	} else {
		this.bus.writeByteSync(this.config.ioaddress, registers.DEFVALB, value);
	}
};

/**
 * Enable interrupts for the pins on the selected port
 *
 * @param port Port where port 0 = pins 0 to 7, port 1 = pins 8 to 15
 * @param value Value is a number between 0 and 255 or 0x00 and 0xFF
 */
MCP23017.prototype.setInterruptOnPort = function (port, value) {
	if (port === 0) {
		this.bus.writeByteSync(this.config.ioaddress, registers.GPINTENA, value);
		this.config.inta = value
	} else {
		this.bus.writeByteSync(this.config.ioaddress, registers.GPINTENB, value);
		this.config.intb = value
	}
};

/**
 * Enable interrupts for the selected pin
 *
 * @param pin Pins 0 to 15
 * @param value Value where 0 = interrupt disabled, 1 = interrupt enabled
 */
MCP23017.prototype.setInterruptOnPin = function (pin, value) {
	if (pin < 8) {
		this.config.inta = this.updateByte(this.config.inta, pin, value);
		this.bus.writeByteSync(this.config.ioaddress, registers.GPINTENA, this.config.inta);
	} else {
		this.config.intb = this.updateByte(this.config.intb, pin - 8, value);
		this.bus.writeByteSync(this.config.ioaddress, registers.GPINTENB, this.config.intb);
	}
};

/**
 * Read the interrupt status for the pins on the selected port
 *
 * @param port Port 0 = pins 0 to 7, port 1 = pins 8 to 15
 * @returns {*} Interrupt status
 */
MCP23017.prototype.readInterruptStatus = function (port) {
	if (port === 0) {
		return this.bus.readByteSync(this.config.ioaddress, registers.INTFA);
	} else {
		return this.bus.readByteSync(this.config.ioaddress, registers.INTFB);
	}
};

/**
 * Read the value from the selected port at the time of the last interrupt trigger
 *
 * @param port Port 0 = pins 0 to 7, port 1 = pins 8 to 15
 * @returns {*} Interrupt capture value
 */
MCP23017.prototype.readInterruptCapture = function (port) {
	if (port === 0) {
		return this.bus.readByteSync(this.config.ioaddress, registers.INTCAPA);
	} else {
		return this.bus.readByteSync(this.config.ioaddress, registers.INTCAPB);
	}
};

/**
 * Reset the interrupts A and B to 0
 */
MCP23017.prototype.resetInterrupts = function () {
	return {
		portOne: this.readInterruptCapture(0),
		portTwo: this.readInterruptCapture(1)
	};
};

module.exports = MCP23017;
