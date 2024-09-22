const { Schema, default: mongoose } = require("mongoose");


const AutoIncrementSchema = new Schema({
  name: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

const AutoIncrement = mongoose.model('AutoIncrement', AutoIncrementSchema)

module.exports = AutoIncrement