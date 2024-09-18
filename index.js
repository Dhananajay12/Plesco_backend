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

app.use(express.static('public')); // Serve static files for client
app.use(express.json());
app.use(cors());
configDotenv()
connections();


app.get('/', (req, res) => {
	res.json({ success: true, status: 'success' })
})




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

		const newUser = await ParticipantUsers.create({ ...req.body });

		return res.json({ statusCode: 200, data: newUser, message: 'Successfully Submitted' })

	} catch (err) {
		return res.json({ statusCode: 400, message: err.message })
	}
})


app.post('/searchUserData', async (req, res) => {
	try {
		const { firstName, lastName, phone, email, dob, area, society, flatNumber, wing } = req.body;


		// Build dynamic search conditions
		let searchConditions = {};

		if (firstName) searchConditions.name = { $regex: firstName, $options: 'i' }; // Case-insensitive partial search
		if (lastName) searchConditions.name = { $regex: lastName, $options: 'i' }; // Case-insensitive partial search
		if (phone) searchConditions.phone = { $regex: phone, $options: 'i' };
		if (email) searchConditions.email = { $regex: email, $options: 'i' };
		if (dob) searchConditions.dob = { $regex: dob, $options: 'i' };
		if (area) searchConditions.area = { $regex: area, $options: 'i' };
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



app.get('/generate-id/:id', async (req, res) => {
	try {

		const userData = await ParticipantUsers.findById(req.params.id);

		if (!userData) throw new Error("user not found")

		const { firstName , lastName, phone, area, photoURL } = userData; // Name from form data
		const cardTemplatePath = path.join(__dirname, 'template.png'); // Path to PNG template

		// Fetch the photo from the URL
		const response = await axios({
			url: photoURL, // URL from DB
			responseType: 'arraybuffer' // To get image as binary data
		});
		const photoBuffer = Buffer.from(response.data, 'binary');

		// Resize the photo using sharp (set desired width and height here)
		const resizedPhoto = await sharp(photoBuffer)
			.resize(350, 390) // Set your desired width and height here
			.toBuffer();

		// Composite the resized photo on the card template
		const cardImage = await sharp(cardTemplatePath)
			.composite([{ input: resizedPhoto, top: 270, left: 175 }]) // Adjust 'top' and 'left' to position the photo
			.toBuffer();

		// Read the card template and user photo using sharp


		// Create a new PDF document
		const pdfDoc = await PDFDocument.create();
		pdfDoc.registerFontkit(fontkit);
		const page = pdfDoc.addPage([350, 500]);

		const pageWidth = page.getWidth();


		// Embed the composed card image into the PDF
		const cardImageEmbed = await pdfDoc.embedPng(cardImage);
		page.drawImage(cardImageEmbed, { x: 0, y: 0, width: 360, height: 500 });

		const poppinsBoldPath = path.join(__dirname, 'Poppins-Bold.ttf');
		const poppinsBoldFont = await fsPromises.readFile(poppinsBoldPath);

		// Embed the custom Poppins font
		const poppinsBold = await pdfDoc.embedFont(poppinsBoldFont);

		const textWidth = poppinsBold.widthOfTextAtSize(`${firstName} ${lastName}`, 18);
		const areaWidth = poppinsBold.widthOfTextAtSize(area, 15);
		const phoneWidth = poppinsBold.widthOfTextAtSize(phone, 16);


		// Calculate the x position to center the text

		const xPosition = (pageWidth - textWidth) / 2;
		// Calculate the x position to center the area text
		const areaXPosition = (pageWidth - areaWidth) / 2;
		const phoneXPosition = (pageWidth - phoneWidth) / 2;


		// Add the user's name to the PDF
		page.drawText(`${firstName} ${lastName}`, {
			x: xPosition,
			y: 125,
			size: 18,
			font: poppinsBold,
			color: rgb(51 / 255, 42 / 255, 126 / 255),
		});

		page.drawText(phone, {
			x: phoneXPosition,
			y: 102,
			size: 16,
			font: poppinsBold,
			color: rgb(69 / 255, 71 / 255, 139 / 255),
		});
		page.drawText(area, {
			x: areaXPosition,
			y: 80,
			size: 15,
			font: poppinsBold,
			color: rgb(223 / 255, 74 / 255, 62 / 255),
		});

		// Save the PDF to a buffer
		const pdfBytes = await pdfDoc.save();

		// Send base64 encoded PDF in JSON response
		const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

		// response
		res.json({ statusCode: 200, data: pdfBase64, message: 'Successfully ID Card Generated' })

	} catch (error) {
		res.json({ statusCode: 400, message: error.message });
	} 
});


app.listen(3000, () => {
	console.log('Server running on http://localhost:3000');
});