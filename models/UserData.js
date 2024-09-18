const { Schema, default: mongoose } = require("mongoose");


const userSchema = new Schema({
	name: { type: String, required: true },
	phone: {
		type: String,
		required: true,
		unique: true
	},
	photoURL: {
		type: String,
		required: true,
	},
	email: {
		type: String,
		required: true,
	},
	dob: {
		type: String,
		require: true
	},
	area: {
		type: String,
		require: true
	},
	society: {
		type: String,
		require: true
	},
	flatNumber: {
		type: String,
		require: true
	},
	wing: {
		type: String,
		require: true
	},
	comment: {
		type: String,
	},
	termsAgree: {
		type: Boolean,
		require: true
	}

}, { timestamps: true })

const ParticipantUsers = mongoose.model('ParticipantUsers', userSchema)

module.exports = ParticipantUsers