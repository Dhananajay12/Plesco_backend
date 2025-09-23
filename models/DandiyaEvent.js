const mongoose = require("mongoose");
const { Schema } = mongoose;

const dandiyaEvent = new Schema({
	uid: { type: Number, required: true , unique:true },
	firstName: { type: String, required: true },
	lastName: { type: String, required: true },
	phone: { type: String, required: true },
	photoURL: { type: String },
	email: { type: String, required: true },
	dob: { type: String, required: true },
	villageName: { type: String },
	society: { type: String, required: true },
	flatNumber: { type: String, required: true },
	wing: { type: String, required: true },
	gender: { type: String, required: true },
	ageGroup: { type: String, required: true },
	events: [
		{
			event: { type: String, required: true },
			year: { type: String, required: true },
			registered: { type: Boolean, default: false },
			attendance: [
				{
					day: { type: Number, required: false , default: 1 }, // 1, 2, 3
					date: { type: Date, required: false, default: '' },  // actual calendar date
					present: { type: Boolean, default: false, default: false}
				}
			],
			isIdDownloaded: { type: Boolean }
		}
	]
},{ timestamps: true });

module.exports = mongoose.model("DandiyaEvent", dandiyaEvent);