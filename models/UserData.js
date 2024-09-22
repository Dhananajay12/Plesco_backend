const { Schema, default: mongoose } = require("mongoose");


const userSchema = new Schema({
	uid: { type: Number, required: true },
	firstName: { type: String, required: true },
	middleName: { type: String},
	lastName: { type: String, required: true },
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
	villageName: {
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
	gender: {
		type: String,
		require: true
	},
  ageGroup: {
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