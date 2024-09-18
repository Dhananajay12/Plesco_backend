const express = require('express');
const multer = require('multer');
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
const cloudinary = require('cloudinary').v2;

app.use(express.static('public')); // Serve static files for client
app.use(express.json());
app.use(cors());
configDotenv()
connections();

cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});


// const photo = multer({ dest: 'photos/' });

app.get('/', (req, res) => {
	res.json({ success: true, status: 'success' })
})


const deleteFolderRecursive = function (path) {
	if (fs.existsSync(path)) {
		fs.readdirSync(path).forEach(function (file, index) {
			var curPath = path + "/" + file;
			if (fs.lstatSync(curPath).isDirectory()) { // recurse
				deleteFolderRecursive(curPath);
			} else { // delete file
				fs.unlinkSync(curPath);
			}
		});
		fs.rmdirSync(path);
	}
};


const deleteFile = (path) => {
	fs.unlink(path, (err) => {
		if (err) {
			console.error('Failed to delete file:', err);
		} else {
			console.log('File deleted successfully');
		}
	})
}

// app.post('/createParticipant', photo.single('photo'), async (req, res) => {
// 	try {
// 		const { name, phone, email, dob, area, society, flatNumber, wing } = req.body;

// 		if (!name?.trim() || !phone?.trim() || !email?.trim() || !dob?.trim() || !area?.trim() || !society?.trim() || !flatNumber?.trim() || !wing?.trim()) {
// 			throw new Error('All fields must be filled')
// 		}

// 		if (!req.file) {
// 			return res.status(400).send('No file uploaded');
// 		}

// 		// Upload image to Cloudinary
// 		const cloudinaryResult = await cloudinary.uploader.upload(req.file.path, {
// 			folder: 'user_photos', // Optional folder in Cloudinary
// 		});

// 		// Remove the file from local uploads folder after Cloudinary upload
// 		await deleteFile(req.file.path)

// 		const data = await ParticipantUsers.findOne({ phone: phone })

// 		if (data) {
// 			throw new Error("Number is already registered")
// 		}

// 		const newUser = await ParticipantUsers.create({ ...req.body, photoURL: cloudinaryResult.secure_url });

// 		return res.json({ statusCode: 200, data: newUser, message: 'Successfully Submitted' })

// 	} catch (err) {
// 		return res.json({ statusCode: 400, message: err.message })
// 	}
// })


app.post('/searchUserData', async (req, res) => {
	try {
		const { name, phone, email, don, area, society, flatNumber, wing } = req.body;


		// Build dynamic search conditions
		let searchConditions = {};

		if (name) searchConditions.name = { $regex: name, $options: 'i' }; // Case-insensitive partial search
		if (phone) searchConditions.phone = { $regex: phone, $options: 'i' };
		if (email) searchConditions.email = { $regex: email, $options: 'i' };
		if (don) searchConditions.don = { $regex: don, $options: 'i' };
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

// setTimeout(async () => {
// 	console.log(await ParticipantUsers.find())
// }, 200);

app.get('/generate-id/:id', async (req, res) => {
	try {

		const userData = await ParticipantUsers.findById(req.params.id);

		if (!userData) throw new Error("user not found")

		const { name, phone, area, photoURL } = userData; // Name from form data
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

		const textWidth = poppinsBold.widthOfTextAtSize(name, 18);
		const areaWidth = poppinsBold.widthOfTextAtSize(area, 15);
		const phoneWidth = poppinsBold.widthOfTextAtSize(phone, 16);


		// Calculate the x position to center the text

		const xPosition = (pageWidth - textWidth) / 2;
		// Calculate the x position to center the area text
		const areaXPosition = (pageWidth - areaWidth) / 2;
		const phoneXPosition = (pageWidth - phoneWidth) / 2;


		// Add the user's name to the PDF
		page.drawText(name, {
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

		// fs.writeFileSync('output.pdf', pdfBytes);
		// Set response headers and send the PDF
		// res.setHeader('Content-Type', 'application/pdf');
		// res.setHeader('Content-Disposition', 'attachment; filename=id-card.pdf');
	

		// Send base64 encoded PDF in JSON response
		const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

		// response
		res.json({ statusCode: 200, data: pdfBase64, message: 'Successfully ID Card Generated' })

	} catch (error) {
		res.json({ statusCode: 400, message: error.message });
	} finally {

		// Clean up the uploaded photo
		if (req.file && fs.existsSync(req.file.path)) {
			await deleteFile(req.file.path)
			console.log('File deleted successfully');
		}
	}
});


app.listen(3000, () => {
	console.log('Server running on http://localhost:3000');
});