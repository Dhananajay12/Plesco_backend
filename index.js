const express = require('express');
const sharp = require('sharp');
const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const fsPromises = require('fs').promises;
const app = express();
const cors = require("cors");
const fontkit = require('@pdf-lib/fontkit');
const { connections } = require('./connection');
const { configDotenv } = require('dotenv');
const ParticipantUsers = require('./models/UserData');
const { default: axios } = require('axios');
const AutoIncrement = require('./models/AutoIncrement');
const XLSX = require('xlsx');
const User = require('./models/User');
const { createCanvas, loadImage, registerFont } = require('canvas');

app.use(express.static('public')); // Serve static files for client
app.use(express.json());
app.use(cors());
configDotenv()
connections();


app.get('/', (req, res) => {
	res.json({ success: true, status: 'success' })
})





const autoIncrementLeadId = async (autoIncField, start = 10000) => {
	const incrementData = await AutoIncrement.findOneAndUpdate(
		{ name: autoIncField },
		{ $inc: { seq: 1 } },
		{
			new: true,
		}
	);

	let newSeq = start;
	if (!incrementData) {
		const newIncrementData = new AutoIncrement({
			name: autoIncField,
			seq: newSeq,
		});
		newIncrementData.save();
	} else {
		newSeq = incrementData.seq;
	}

	let temp = newSeq.toString();
	return temp;
};




app.post('/login', async (req, res) => {
	try {
		const { userName, password } = req.body;
		
		const user = await User.findOne({ userName, password })

		if (user) {
			return res.json({ statusCode: 200, message: 'Successfully user authorized' })
		} else {
			return res.json({ statusCode: 400, message: "Username and password is invalid" })
		}

	} catch (err) {
		return res.json({ statusCode: 400, message: err.message })
	}
});


app.post('/createParticipant', async (req, res) => {
	try {
		const { firstName, lastName, phone, email, dob, villageName, society, flatNumber, wing, photoURL, gender, ageGroup } = req.body;


		if (!firstName?.trim() || !lastName?.trim() || !phone?.trim() || !email?.trim() || !dob?.trim() || !villageName?.trim() || !society?.trim() || !flatNumber?.trim() || !wing?.trim() || !photoURL?.trim() || !gender?.trim() || !ageGroup?.trim()) {
			throw new Error('All fields must be filled')
		}

		const data = await ParticipantUsers.findOne({ phone: phone })

		if (data) {
			throw new Error("Number is already registered")
		}
		const uid = await autoIncrementLeadId("userId")

		console.log(uid)

		const newUser = await ParticipantUsers.create({ ...req.body, uid });

		return res.json({ statusCode: 200, data: newUser, message: 'Successfully Submitted' })

	} catch (err) {
		return res.json({ statusCode: 400, message: err.message })
	}
})


app.post('/searchUserData', async (req, res) => {
	try {
		const { firstName, lastName, phone, email, dob, villageName, society, flatNumber, wing } = req.body;


		// Build dynamic search conditions
		let searchConditions = {};

		if (firstName) searchConditions.firstName = { $regex: firstName, $options: 'i' }; // Case-insensitive partial search
		if (lastName) searchConditions.lastName = { $regex: lastName, $options: 'i' }; // Case-insensitive partial search
		if (phone) searchConditions.phone = { $regex: phone, $options: 'i' };
		if (email) searchConditions.email = { $regex: email, $options: 'i' };
		if (dob) searchConditions.dob = { $regex: dob, $options: 'i' };
		if (villageName) searchConditions.villageName = { $regex: villageName, $options: 'i' };
		if (society) searchConditions.society = { $regex: society, $options: 'i' };
		if (flatNumber) searchConditions.flatNumber = { $regex: flatNumber, $options: 'i' };
		if (wing) searchConditions.wing = { $regex: wing, $options: 'i' };

		// Query the database based on the search conditions
		let users = [];

		if (Object.keys(searchConditions).length > 0) {
			users = await ParticipantUsers.find(searchConditions);
			if (users.length === 0) {
				throw new Error('Participant data not found');
			}
		} else {
			users = await ParticipantUsers.find();
		}

		return res.json({ statusCode: 200, data: users, message: 'Successfully user data found' })

	} catch (err) {
		return res.json({ statusCode: 400, message: err.message })
	}
})


app.get('/download-excel', async (req, res) => {
	// Create a new workbook
	try {

		const data = await ParticipantUsers.find();

		const userData = data.map((item,index) => {
			return {
				srNo: index + 1,
				uid: item.uid,
				firstName: item.firstName,
				lastName: item.lastName,
				phone: item.phone,
				photoURL: item.photoURL,
				email: item.email,
				dob: item.dob,
				villageName: item.villageName,
				society: item.society,
				flatNumber: item.flatNumber,
				wing: item.wing,
				gender: item.gender,
				ageGroup: item.ageGroup,
			}
		})

		const workbook = XLSX.utils.book_new();

		// Convert the data array to a worksheet
		const worksheet = XLSX.utils.json_to_sheet(userData);

		// Append the worksheet to the workbook
		XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

		// Generate the Excel file as a buffer
		const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

		// Convert the buffer to a base64 string
		const excelBase64 = excelBuffer.toString('base64');

		// Send the base64 encoded Excel data as part of the JSON response
		res.json({
			statusCode: 200,
			data: excelBase64,
			message: 'Successfully generated Excel data'
		});

	} catch (err) {
		res.json({ statusCode: 400, message: err.message });
	}
});


app.post('/generate-id', async (req, res) => {

	try {

		const { generateIds } = req.body;

		const usersData = await ParticipantUsers.find({ uid: { $in: generateIds } });

		if (!usersData || usersData.length === 0) {
			throw new Error('Users not found');
		}

		const cardTemplatePath = path.join(__dirname, 'template.png'); // Path to PNG template

		// Create a new PDF document
		const pdfDoc = await PDFDocument.create();
		pdfDoc.registerFontkit(fontkit);

		const cardTemplateMetadata = await sharp(cardTemplatePath).metadata();
		const cardWidth = cardTemplateMetadata.width;
		const cardHeight = cardTemplateMetadata.height;

		const poppinsBoldPath = path.join(__dirname, 'Poppins-Bold.ttf');
		const poppinsBoldFont = await fsPromises.readFile(poppinsBoldPath);

		// Embed the custom Poppins font
		const poppinsBold = await pdfDoc.embedFont(poppinsBoldFont);

		for (const userData of usersData) {

			const { uid, firstName, lastName, phone, photoURL } = userData;
			// Fetch the photo from the URL
			const response = await axios({
				url: photoURL, // URL from DB
				responseType: 'arraybuffer', // To get image as binary data
			}).then(res => res).catch(err => err);

			if (response?.response?.status == 404) {
				continue;
			}

			const photoBuffer = Buffer.from(response.data, 'binary');

			// Resize the photo using sharp (set desired width and height here)
			const resizedPhoto = await sharp(photoBuffer)
				.resize(240, 300) // Set your desired width and height here
				.toBuffer();

			const left = (cardWidth - 200) / 2; // Center image horizontally on ID card
			const top = (cardHeight - 360) / 2; // Adjust as needed to center vertically

			// Add 3mm (11px) margin to the card image
			const whiteMargin = 22; // Approx 3mm in pixels

			// Composite the resized photo on the card template
			const cardImage = await sharp(cardTemplatePath)
				.extend({
					top: whiteMargin,
					bottom: whiteMargin,
					left: whiteMargin,
					right: whiteMargin,
					background: { r: 255, g: 255, b: 255, alpha: 1 }, // White color
				})
				.composite([{ input: resizedPhoto, top: parseInt(top), left: parseInt(left) }]) // Adjust 'top' and 'left' to position the photo
				.toBuffer();


			// Set PDF page size to 161x252 pixels
			const page = pdfDoc.addPage([161, 252]);
			const pageWidth = 161;

			// Embed the composed card image into the PDF
			const cardImageEmbed = await pdfDoc.embedPng(cardImage);
			page.drawImage(cardImageEmbed, { x: 0, y: 0, width: 161, height: 252 });


			const fullName = `${firstName} ${lastName}`;

			const textWidth = poppinsBold.widthOfTextAtSize(fullName, 12);
			// const areaWidth = poppinsBold.widthOfTextAtSize(uid.toString(), 15);
			const phoneWidth = poppinsBold.widthOfTextAtSize(phone, 10);
			const uidWidth = poppinsBold.widthOfTextAtSize(uid.toString(), 8);


			// Calculate the x position to center the text
			const xPosition = (pageWidth - textWidth) / 2;
			const phoneXPosition = (pageWidth - phoneWidth) / 2;
			const uidXPosition = (pageWidth - uidWidth) / 2;


			// Add the user's name to the PDF
			page.drawText(fullName, {
				x: xPosition,
				y: 80,
				size: 12,
				font: poppinsBold,
				color: rgb(51 / 255, 42 / 255, 126 / 255),
			});

			page.drawText(phone, {
				x: phoneXPosition,
				y: 65,
				size: 10,
				font: poppinsBold,
				color: rgb(69 / 255, 71 / 255, 139 / 255),
			});

			page.drawText(uid.toString(), {
				x: uidXPosition,
				y: 53,
				size: 8,
				font: poppinsBold,
				color: rgb(223 / 255, 74 / 255, 62 / 255),
			});
			userData.isDownloaded = true;
			userData.save();

		}

		// Save the PDF to a buffer
		const pdfBytes = await pdfDoc.save();

		// Send base64 encoded PDF in JSON response
		const pdfBase64 = Buffer.from(pdfBytes).toString('base64');


		res.json({ statusCode: 200, data: pdfBase64, message: 'Successfully ID Card Generated' });
	} catch (error) {
		res.json({ statusCode: 400, message: error.message });
	}



})


//sigle id card on one page without a4 size

app.get('/generate-id/:id', async (req, res) => {
	try {
		const userData = await ParticipantUsers.findById(req.params.id);

		if (!userData) throw new Error("User not found");

		const { uid, firstName, lastName, phone, photoURL } = userData;
		const cardTemplatePath = path.join(__dirname, 'template.png');

		const cardTemplateMetadata = await sharp(cardTemplatePath).metadata();
		const cardWidth = 161;  // Set card width to 161
		const cardHeight = 252;  // Set card height to 252


		const response = await axios({
			url: photoURL,
			responseType: 'arraybuffer',
		}).then(res => res).catch(err => err);

		if (response?.response?.status == 404) {
			throw new Error('Image profile URL not found in database');
		}

		const photoBuffer = Buffer.from(response.data, 'binary');

		const resizedPhoto = await sharp(photoBuffer)
			.resize(240, 300)
			.toBuffer();

		const left = (cardWidth - 100) / 2;
		const top = (cardHeight - 160) / 2;

		const whiteMargin = 22;

		const cardImage = await sharp(cardTemplatePath)
			.composite([{ input: resizedPhoto, top: 300, left: 230 }])
			.toBuffer();

		// Create a canvas to draw the card

		const canvas = createCanvas(cardWidth, cardHeight);
		const context = canvas.getContext('2d');

		// Draw the card image
		const cardImageLoaded = await loadImage(cardImage);
		context.drawImage(cardImageLoaded, 0, 0, cardWidth, cardHeight);

		// Register and load the custom font
		const poppinsBoldPath = path.join(__dirname, 'Poppins-Bold.ttf');
		registerFont(poppinsBoldPath, { family: 'Poppins', weight: 'bold' });

		// Draw the user's name
		context.font = '12px Poppins';
		context.fillStyle = 'rgba(51, 42, 126, 1)'; // Name color
		const fullName = `${firstName} ${lastName}`;
		const nameWidth = context.measureText(fullName).width;
		context.fillText(fullName, (cardWidth - nameWidth) / 2, 180);

		// Draw the phone number
		context.font = '9px Poppins';
		context.fillStyle = 'rgba(69, 71, 139, 1)'; // Phone color
		const phoneWidth = context.measureText(phone).width;
		context.fillText(phone, (cardWidth - phoneWidth) / 2, 195);

		// Draw the UID
		context.font = '8px Poppins';
		context.fillStyle = 'rgba(223, 74, 62, 1)'; // UID color
		const uidWidth = context.measureText(uid.toString()).width;
		context.fillText(uid.toString(), (cardWidth - uidWidth) / 2, 210);

		// Convert canvas to PNG
		const buffer = canvas.toBuffer('image/jpeg');

		// Convert PNG buffer to base64
		const base64Image = buffer.toString('base64');

		userData.isDownloaded = true;
		await userData.save();

		res.json({ statusCode: 200, data: base64Image, message: 'Successfully ID Card Generated' });
	} catch (error) {
		res.json({ statusCode: 400, message: error.message });
	}
});
app.listen(3000, () => {
	console.log('Server running on http://localhost:3000');
});