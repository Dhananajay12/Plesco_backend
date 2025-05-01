const { Schema, default: mongoose } = require("mongoose");


const participantUserDataSchema = new Schema({
	uid: { type: Number, required: true },
	firstName: { type: String, required: true },
	middleName: { type: String },
	lastName: { type: String, required: true },
	fatherFirstName: { type: String},
	fatherMiddleName: { type: String },
	fatherLastName: { type: String },
	motherFirstName: { type: String },
	motherMiddleName: { type: String },
  motherLastName: { type: String },
	phone: {
		type: String,
		required: true,
	},
	societyId: { type: Number },
	photoURL: {
		type: String,
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
	address:{
		type: String,
	},
	gender: {
		type: String,
		require: true
	},
	ageGroup: {
		type: String,
		require: true
	},
});

const participantUserData = mongoose.model('ParticipantUserData', participantUserDataSchema)

module.exports = participantUserData