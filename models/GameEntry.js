const { Schema, default: mongoose } = require("mongoose");


const participantEntry = new Schema({
	user: {
		type: mongoose.Schema.Types.ObjectId,  // Important: we store User's _id
		ref: 'ParticipantUserData'
	},
	registerationYear: { type: Number },
	gameName: { type: String },
	photoURL: { type: String },
	teamName: { type: String },
	event: { type: String },
	multiplayerGame: { type: Boolean },
	socity: { type: String },
	socityId: { type: String },
	player1: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'ParticipantUserData',
	},
	player2: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'ParticipantUserData',
	},
	player3: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'ParticipantUserData',
	},
	player4: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'ParticipantUserData',
	},
	player5: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'ParticipantUserData',
	},
	player6: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'ParticipantUserData',
	},
	player7: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'ParticipantUserData',
	},
	player8: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'ParticipantUserData',
	},
	player9: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'ParticipantUserData',
	},
	player10: {
		type: mongoose.Schema.Types.ObjectId,
		ref: 'ParticipantUserData',
	},
	isDownloaded: {
		type: Boolean,
		default: false
	},
	comment: {
		type: String,
	},
	termsAgree: {
		type: Boolean,
		require: true
	},
}, { timestamps: true })

const ParticipantEntry = mongoose.model('ParticipantEntry', participantEntry)

module.exports = ParticipantEntry