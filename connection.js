const { default: mongoose } = require("mongoose");

function connections() {
	const mongoDBUrl = process.env.MONGO_DB_URL;

	if (!mongoDBUrl) {
		console.error("MongoDB URL is not defined in the environment variables.");
		return;
	}

	mongoose.connect(mongoDBUrl)
		.then(() => console.log("Succesfully conntected"))
		.catch((err) => console.log(err))
}


module.exports.connections = connections




