const express = require('express');
const sharp = require('sharp');
const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const fsPromises = require('fs').promises;
const app = express();
const cors = require("cors");
const crypto = require("crypto");

const fontkit = require('@pdf-lib/fontkit');
const { connections } = require('./connection');
const { configDotenv } = require('dotenv');
const ParticipantEntry = require('./models/GameEntry');
const { default: axios } = require('axios');
const AutoIncrement = require('./models/AutoIncrement');
const XLSX = require('xlsx');
const User = require('./models/User');
const { createCanvas, loadImage, registerFont } = require('canvas');
const participantUserData = require('./models/ParticipantUserData');
const DandiyaEvent = require('./models/DandiyaEvent');

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

async function createParticipantUser(userData, societyId = '') {
	// Check if a user with same name and phone already exists
	let uid;

	// First, try to find user by phone
	let existingUser = await participantUserData.findOne({ phone: userData.phone });

	if (existingUser) {
		uid = existingUser.uid;
	} else {
		uid = await autoIncrementLeadId("userId");
	}

	// Update if exists, or insert if not
	const updatedUser = await participantUserData.findOneAndUpdate(
		{ phone: userData.phone },
		{ $set: { ...userData, uid, societyId } },
		{ upsert: true, new: true }
	);

	return updatedUser._id;
}


app.get("/getDandiyaUser/:uid", async (req, res) => {
	try {
		const data = await DandiyaEvent.findOne({
			uid: req.params.uid,
		})

		if (!data) {
			throw new Error("Participant data not found")
		}
		return res.json({ statusCode: 200, data: data, message: 'Successfully Submitted' })
	} catch (err) {
		return res.json({ statusCode: 400, message: err.message })
	}
})

app.get("/getDandiyaUser/dandiya/:uid/:phone", async (req, res) => {
	try {
		const data = await DandiyaEvent.findOne({
			uid: req.params.uid,
			phone: req.params.phone
		})

		if (!data) {
			throw new Error("Participant data not found")
		}
		return res.json({ statusCode: 200, data: data, message: 'Successfully Submitted' })
	} catch (err) {
		return res.json({ statusCode: 400, message: err.message })
	}
})


app.put("/updateDandiyaUser/:uid", async (req, res) => {
	try {
		const updateData = { ...req.body };

		const user = await DandiyaEvent.findOne({ uid: req.params.uid });

		if (!user) {
			throw new Error("Participant not found");
		}

		if (
			user.phone === updateData.phone &&
			user.events?.some(ev => ev.year === "2025")
		) {
			throw new Error("Number is already registered for Dandiya 2025");
		}

		// ✅ Merge events if provided
		if (updateData.events && Array.isArray(updateData.events)) {
			updateData.events = [...user.events, ...updateData.events];
		}
		// Normal update (if no events provided)
		const updatedUser = await DandiyaEvent.findOneAndUpdate(
			{ uid: req.params.uid },
			{ $set: updateData },
			{ new: true }
		);


		return res.json({
			statusCode: 200,
			data: updatedUser,
			message: "Participant details updated successfully"
		});
	} catch (err) {
		return res.json({ statusCode: 400, message: err.message });
	}
});

const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;


app.post('/delete-image', async (req, res) => {
	try {
		const { publicId } = req.body;
		if (!publicId) return res.status(400).json({ error: 'public_id is required' });

		const timestamp = Math.floor(Date.now() / 1000);
		const stringToSign = `public_id=${publicId}&timestamp=${timestamp}`;
		const signature = crypto.createHash('sha1').update(stringToSign + CLOUDINARY_API_SECRET).digest('hex');

		// Prepare form data for Cloudinary
		const formData = new FormData();
		formData.append('public_id', publicId);
		formData.append('api_key', CLOUDINARY_API_KEY);
		formData.append('timestamp', timestamp);
		formData.append('signature', signature);

		// Call Cloudinary destroy endpoint

		const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`, {
			method: 'POST',
			body: formData,
			headers: {
				'X-Requested-With': 'XMLHttpRequest', // Optional, but can help with CORS issues
			},
		});

		const data = await response.json();
		console.log(data)
		return res.json({ status: 'success', data });
	} catch (error) {
		console.error('Delete failed:', error);
		return res.status(500).json({ status: 'error', error: error.message });
	}
});


app.post('/createParticipant', async (req, res) => {
	try {

		if (req.body?.event === 'dandiya') {

			const { firstName, lastName, phone, email, dob, villageName, society, flatNumber, wing, photoURL, gender, ageGroup } = req.body;

			if (!firstName?.trim() || !lastName?.trim() || !phone?.trim() || !email?.trim() || !dob?.trim() || !villageName?.trim() || !society?.trim() || !flatNumber?.trim() || !wing?.trim() || !photoURL?.trim() || !gender?.trim() || !ageGroup?.trim()) {
				throw new Error('All fields must be filled')
			}

			const existingUser = await DandiyaEvent.findOne({
				phone: req.body.phone,
			});

			// Case 1: Phone already exists
			if (existingUser) {
				// Check if 2025 event already registered for this phone
				const has2025 = existingUser.events?.some(ev => ev.year === "2025");
				if (has2025) {
					throw new Error("Number is already registered for Dandiya 2025");
				}

				// Otherwise, phone exists but not for 2025
				throw new Error("Phone number is already registered. Please use the 'Already Registered' tab to Register. ");
			}



			const uid = await autoIncrementLeadId("dandiyaUserId");

			const newUser = await DandiyaEvent.create({ ...req.body, uid });

			return res.json({
				statusCode: 200,
				data: newUser,
				message: "Successfully Submitted",
			});



		} else if (req.body?.event === 'plesco') {

			// const { firstName, lastName, phone, email, dob, address, society, flatNumber, wing, photoURL, gender, ageGroup } = req.body.user;
			// if (!firstName?.trim() || !lastName?.trim() || !phone?.trim() || !email?.trim() || !dob?.trim() || !address?.trim() || !society?.trim() || !flatNumber?.trim() || !wing?.trim() || !photoURL?.trim() || !gender?.trim() || !ageGroup?.trim()) {
			// 	throw new Error('All fields must be filled')
			// }

			const { user, ...rest } = req.body;


			const multiplayerGame = ['Cricket', 'Badmintion', 'Football']

			let societyId = ''

			if (multiplayerGame.includes(req?.body?.gameName)) {
				societyId = await autoIncrementLeadId("societyId", 200000);
				user.photoURL = ''
			}


			// Step 1: Create main user
			const userId = user ? await createParticipantUser(user, societyId) : null;

			// Step 2: Handle all players dynamically
			const playerFields = {};
			for (let key in rest) {
				if (key.startsWith('player') && rest[key]) {
					rest[key].gender = user.gender;
					const playerId = await createParticipantUser(rest[key], societyId);
					playerFields[key] = playerId;
				}
			}

			// Step 3: Other fields like registerationYear, gameName, teamName etc
			const entryOtherData = {};
			for (let key in rest) {
				if (!key.startsWith('player')) {
					entryOtherData[key] = rest[key];
				}
			}


			// Step 4: Create the Entry
			const newEntry = await ParticipantEntry.create({
				...entryOtherData,
				user: userId,
				...playerFields,
				multiplayerGame: multiplayerGame.includes(req?.body?.gameName) ? true : false,
				photoURL: multiplayerGame.includes(req?.body?.gameName) ? req?.body?.photoURL : ''
			});

			return res.json({ statusCode: 200, data: newEntry, message: 'Successfully Submitted' })
		}

	} catch (err) {
		return res.json({ statusCode: 400, message: err.message })
	}
})


app.get("/participant/marker/:query", async (req, res) => {
	try {
		const { query } = req.params; // frontend sends ?query=1234

		const participant = await DandiyaEvent.findOne({
			$or: [{ uid: query }, { phone: query }]
		});

		if (!participant) {
			return res.json({ statusCode: 400, message: "Participant not found" });
		}
		res.json({ statusCode: 200, message: "Successfully Fetch", data: participant });
	} catch (err) {
		return res.json({ statusCode: 400, message: err.message });
	}
});

app.post("/mark-attendance", async (req, res) => {
	try {
		const { uid, phone } = req.body;

		const year = new Date().getFullYear().toString();
		const event = "dandiya"; // or keep configurable if needed
		const today = new Date();
		const todayStr = today.toDateString(); // to compare only date part

		// Build query (uid or phone)
		const query = uid ? { uid } : { phone };

		// Find participant
		const participant = await DandiyaEvent.findOne(query);
		if (!participant) {
			return res.json({ statusCode: 400, message: "Participant not found" });
		}

		// Find correct event inside participant
		const eventObj = participant.events.find(e => e.year === year && e.event === event);
		if (!eventObj) {
			return res.json({ statusCode: 400, message: "Not registered for event this year" });
		}

		// Check if today's attendance already exists
		let existingDay = eventObj.attendance.find(
			a => new Date(a.date).toDateString() === todayStr
		);

		if (existingDay) {
			// Update existing
			// existingDay.present = true;
			return res.json({ statusCode: 400, message: "Attendance already marked for today" });
		} else {
			// Push new attendance entry
			eventObj.attendance.push({
				date: today,
				present: true
			});
		}

		await participant.save();

		res.json({ statusCode: 200, message: "Attendance marked for today", participant });
	} catch (err) {
		console.error(err);
		res.json({ statusCode: 400, error: "Server error" });
	}
});



app.post('/searchUserData', async (req, res) => {
	try {
		const { firstName, lastName, phone, email, dob, villageName, society, flatNumber, wing } = req.body;

		let page = Number(req?.body?.page) || 0;
		let limit = Number(req?.body?.limit) || 50;
		let skip = limit * page;

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
		const totalDoc = await DandiyaEvent.countDocuments()
		if (Object.keys(searchConditions).length > 0) {
			users = await DandiyaEvent.find({ ...searchConditions }).sort({ _id: -1 })
				.limit(limit)
				.skip(skip);

			if (users.length === 0) {
				throw new Error('Participant data not found');
			}
		} else {
			users = await DandiyaEvent.find().sort({ _id: -1 })
				.limit(limit)
				.skip(skip);
		}

		// Add current year isIdDownloaded info
		const currentYear = new Date().getFullYear().toString();
		const usersWithDownloadStatus = users.map(user => {
			const event = user.events.find(e => e.year === currentYear);
			return {
				...user.toObject(),
				isIdDownloaded: event ? event.isIdDownloaded || false : false
			};
		});

		return res.json({
			statusCode: 200,
			data: { users: usersWithDownloadStatus, totalDoc },
			message: 'Successfully user data found'
		});

		// return res.json({ statusCode: 200, data: { users, totalDoc }, message: 'Successfully user data found' })

	} catch (err) {
		return res.json({ statusCode: 400, message: err.message })
	}
})



app.post('/searchParticipantEntries', async (req, res) => {
	try {
		const { firstName, lastName, phone, email, dob, villageName, society, flatNumber, wing, registrationYear, teamName, event, socity, socityId } = req.body;

		let page = Number(req.body.page) || 0;
		let limit = Number(req.body.limit) || 50;
		let skip = limit * page;

		// Step 1: Build user filter if needed
		let userFilter = {};
		if (firstName) userFilter.firstName = { $regex: firstName.trim(), $options: 'i' };
		if (lastName) userFilter.lastName = { $regex: lastName.trim(), $options: 'i' };
		if (phone) userFilter.phone = { $regex: phone.trim(), $options: 'i' };
		if (email) userFilter.email = { $regex: email, $options: 'i' };
		if (dob) userFilter.dob = { $regex: dob, $options: 'i' };
		if (villageName) userFilter.villageName = { $regex: villageName, $options: 'i' };
		if (society) userFilter.society = { $regex: society.trim(), $options: 'i' };
		if (flatNumber) userFilter.flatNumber = { $regex: flatNumber, $options: 'i' };
		if (wing) userFilter.wing = { $regex: wing, $options: 'i' };

		let userIds = [];
		if (Object.keys(userFilter).length > 0) {
			const matchedUsers = await participantUserData.find(userFilter).select('_id');
			userIds = matchedUsers.map(u => u._id);
			if (userIds.length === 0) {
				return res.json({ statusCode: 200, data: { users: [], totalDoc: 0 }, message: 'No matching users found' });
			}
		}

		// Step 2: Build ParticipantEntry search conditions
		let searchConditions = {};
		if (registrationYear) searchConditions.registrationYear = registrationYear;
		if (teamName) searchConditions.teamName = { $regex: teamName.trim(), $options: 'i' };
		if (event) searchConditions.event = { $regex: event, $options: 'i' };
		if (socity) searchConditions.socity = { $regex: socity.trim(), $options: 'i' };
		if (socityId) searchConditions.socityId = { $regex: socityId, $options: 'i' };
		if (userIds.length > 0) searchConditions.user = { $in: userIds };

		const totalDoc = await ParticipantEntry.countDocuments(searchConditions);

		let users = await ParticipantEntry.find(searchConditions)
			.populate('user player1 player2 player3 player4 player5 player6 player7 player8 player9 player10')
			.sort({ _id: -1 })
			.skip(skip)
			.limit(limit);

		if (users.length === 0) {
			throw new Error('Participant data not found');
		}

		return res.json({ statusCode: 200, data: { users, totalDoc }, message: 'Successfully found participant entries' });

	} catch (err) {
		return res.json({ statusCode: 400, message: err.message });
	}
});


// app.get('/download-excel/:event', async (req, res) => {
// 	// Create a new workbook
// 	try {

// 		const data = await ParticipantEntry.find({event:req.params.event});

// 		const userData = data.map((item, index) => {
// 			return {
// 				srNo: index + 1,
// 				uid: item.uid,
// 				firstName: item.firstName,
// 				lastName: item.lastName,
// 				phone: item.phone,
// 				photoURL: item.photoURL,
// 				email: item.email,
// 				dob: item.dob,
// 				villageName: item.villageName,
// 				society: item.society,
// 				flatNumber: item.flatNumber,
// 				wing: item.wing,
// 				gender: item.gender,
// 				ageGroup: item.ageGroup,
// 			}
// 		})

// 		const workbook = XLSX.utils.book_new();

// 		// Convert the data array to a worksheet
// 		const worksheet = XLSX.utils.json_to_sheet(userData);

// 		// Append the worksheet to the workbook
// 		XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

// 		// Generate the Excel file as a buffer
// 		const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

// 		// Convert the buffer to a base64 string
// 		const excelBase64 = excelBuffer.toString('base64');

// 		// Send the base64 encoded Excel data as part of the JSON response
// 		res.json({
// 			statusCode: 200,
// 			data: excelBase64,
// 			message: 'Successfully generated Excel data'
// 		});

// 	} catch (err) {
// 		res.json({ statusCode: 400, message: err.message });
// 	}
// });



app.get('/download-excel/:event', async (req, res) => {
	// Create a new workbook
	try {


		let userData = []

		if (req.params.event === 'dandiya') {
			const dandiya = await DandiyaEvent.find();
			userData = dandiya.map((item, index) => {
				const event2024 = item.events.find(ev => ev.year === "2024");
				const event2025 = item.events.find(ev => ev.year === "2025");
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
					// extra columns
					registered2024: event2024?.registered === true ? 'YES' : 'NO',
					registered2025: event2025?.registered === true ? 'YES' : 'NO',
				}
			})
		} else if (req.params.event === 'plesco') {
			const data = await ParticipantEntry.find({ event: req.params.event }).populate('user player1 player2 player3 player4 player5 player6 player7 player8 player9 player10')

			userData = data.map((item, index) => {
				const base = {
					srNo: index + 1,
					uid: item.user?.uid || '',
					"firstName (player/captain)": item.user?.firstName || '',
					"lastName (player/captain)": item.user?.lastName || '',
					phone: item.user?.phone || '',
					email: item.user?.email || '',
					dob: item.user?.dob || '',
					gender: item.user?.gender || '',
					ageGroup: item.user?.ageGroup || '',
					villageName: item.user?.villageName || '',
					society: item.user?.society || '',
					flatNumber: item.user?.flatNumber || '',
					wing: item.user?.wing || '',
					teamName: item.teamName || '',
					gameName: item.gameName || '',
					event: item.event || '',
					registerationYear: item.registerationYear || '',
					comment: item.comment || '',
					termsAgree: item.termsAgree ? 'Yes' : 'No',
				};

				// Add player1 to player10 (if exists), in short form
				for (let i = 1; i <= 10; i++) {
					const player = item[`player${i}`];
					if (player) {
						base[`player${i}_uid`] = player.uid || '';
						base[`player${i}_firstName`] = player.firstName || '';
						base[`player${i}_middleName`] = player.middleName || '';
						base[`player${i}_lastName`] = player.lastName || '';
						base[`player${i}_fatherFirstName`] = player.fatherFirstName || '';
						base[`player${i}_fatherMiddleName`] = player.fatherMiddleName || '';
						base[`player${i}_fatherLastName`] = player.fatherLastName || '';
						base[`player${i}_motherFirstName`] = player.motherFirstName || '';
						base[`player${i}_motherMiddleName`] = player.motherMiddleName || '';
						base[`player${i}_motherLastName`] = player.motherLastName || '';
						base[`player${i}_phone`] = player.phone || '';
						base[`player${i}_societyId`] = player.societyId || '';
						base[`player${i}_email`] = player.email || '';
						base[`player${i}_dob`] = player.dob || '';
						base[`player${i}_society_name`] = player.society || '';
						base[`player${i}_flatNumber`] = player.flatNumber || '';
						base[`player${i}_wing`] = player.wing || '';
					}
				}

				return base
			})
		}


		const worksheet = XLSX.utils.json_to_sheet(userData);
		const csv = XLSX.utils.sheet_to_csv(worksheet);

		// Convert CSV string to base64
		const csvBase64 = Buffer.from(csv, 'utf8').toString('base64');

		// Respond with base64 encoded CSV
		res.json({
			statusCode: 200,
			data: csvBase64,
			message: 'Successfully generated CSV data'
		});

	} catch (err) {
		res.json({ statusCode: 400, message: err.message });
	}
});

app.post('/generate-id', async (req, res) => {

	try {

		const { generateIds } = req.body;

		const usersData = await ParticipantEntry.find({ uid: { $in: generateIds } });

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
		const userData = await DandiyaEvent.findById(req.params.id);

		if (!userData) throw new Error("User not found");

		const { uid, firstName, lastName, phone, photoURL } = userData;
		const cardTemplatePath = path.join(__dirname, 'template.png');

		const cardTemplateMetadata = await sharp(cardTemplatePath).metadata();
		const cardWidth = 1346;  // Set card width to 161
		const cardHeight = 2102;  // Set card height to 252


		const response = await axios({
			url: photoURL,
			responseType: 'arraybuffer',
		}).then(res => res).catch(err => err);

		if (response?.response?.status == 404) {
			throw new Error('Image profile URL not found in database');
		}

		const photoBuffer = Buffer.from(response.data, 'binary');

		const resizedPhoto = await sharp(photoBuffer)
			.resize(600, 700)
			.toBuffer();

		const left = (cardWidth - 600) / 2;
		const top = (cardHeight - 950) / 2;


		const whiteMargin = 22;

		const cardImage = await sharp(cardTemplatePath)
			.composite([{ input: resizedPhoto, top: parseInt(top), left: parseInt(left) }])
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
		context.font = '100px Poppins';
		context.fillStyle = 'rgba(51, 42, 126, 1)'; // Name color
		const fullName = `${firstName} ${lastName}`;
		const nameWidth = context.measureText(fullName).width;
		context.fillText(fullName, (cardWidth - nameWidth) / 2, 1440);

		// Draw the phone number
		context.font = '70px Poppins';
		context.fillStyle = 'rgba(69, 71, 139, 1)'; // Phone color
		const phoneWidth = context.measureText(phone).width;
		context.fillText(phone, (cardWidth - phoneWidth) / 2, 1550);

		// Draw the UID
		context.font = '50px Poppins';
		context.fillStyle = 'rgba(223, 74, 62, 1)'; // UID color
		const uidWidth = context.measureText(uid.toString()).width;
		context.fillText(uid.toString(), (cardWidth - uidWidth) / 2, 1640);

		// Convert canvas to PNG
		const buffer = canvas.toBuffer('image/jpeg');

		// Convert PNG buffer to base64
		const base64Image = buffer.toString('base64');

		const currentYear = new Date().getFullYear().toString();
		const eventIndex = userData.events.findIndex(e => e.year === currentYear);

		if (eventIndex !== -1) {
			userData.events[eventIndex].isIdDownloaded = true;
		}

		await userData.save();

		res.json({ statusCode: 200, data: { base64: base64Image, name: fullName }, message: 'Successfully ID Card Generated' });
	} catch (error) {
		res.json({ statusCode: 400, message: error.message });
	}
});



app.get('/plesco-generate-id/:id', async (req, res) => {
	try {
		const participantEntry = await ParticipantEntry.findById(req.params.id)
			.populate('user')
			.populate('player1')
			.populate('player2')
			.populate('player3')
			.populate('player4')
			.populate('player5')
			.populate('player6')
			.populate('player7')
			.populate('player8')
			.populate('player9')
			.populate('player10');

		if (!participantEntry) throw new Error("Participant Entry not found");

		// Collect all users
		const users = [];

		if (participantEntry.user) users.push(participantEntry.user);
		for (let i = 1; i <= 10; i++) {
			const player = participantEntry[`player${i}`];
			if (player) users.push(player);
		}

		const results = [];

		for (const userData of users) {
			const { uid, firstName, lastName, phone } = userData;

			const cardTemplatePath = path.join(__dirname, 'plesco.png');
			const cardWidth = 449;
			const cardHeight = 700;

			// Fetch photo
			const response = await axios({
				url: participantEntry.multiplayerGame ? participantEntry.photoURL : participantEntry?.user?.photoURL,
				responseType: 'arraybuffer',
			}).then(res => res).catch(err => err);

			if (response?.response?.status == 404) {
				throw new Error('Image profile URL not found in database');
			}

			const photoBuffer = Buffer.from(response.data, 'binary');

			// Resize photo
			const resizedPhoto = await sharp(photoBuffer)
				.resize(200, 200)
				.toBuffer();

			const left = (cardWidth - 200) / 2;
			const top = (cardHeight - 330) / 2;

			// Composite photo onto template
			const cardImage = await sharp(cardTemplatePath)
				.composite([{ input: resizedPhoto, top: parseInt(top), left: parseInt(left) }])
				.toBuffer();

			// Canvas setup
			const canvas = createCanvas(cardWidth, cardHeight);
			const context = canvas.getContext('2d');

			const cardImageLoaded = await loadImage(cardImage);
			context.drawImage(cardImageLoaded, 0, 0, cardWidth, cardHeight);

			// Register Font
			const poppinsBoldPath = path.join(__dirname, 'Poppins-Bold.ttf');
			registerFont(poppinsBoldPath, { family: 'Poppins', weight: 'bold' });

			// Draw Name
			context.font = '40px Poppins';
			context.fillStyle = 'rgba(51, 42, 126, 1)';
			const fullName = `${firstName} ${lastName}`;
			const nameWidth = context.measureText(fullName).width;
			context.fillText(fullName, (cardWidth - nameWidth) / 2, 450);

			// Draw Phone
			context.font = '20px Poppins';
			context.fillStyle = 'rgba(69, 71, 139, 1)';
			const phoneWidth = context.measureText(phone).width;
			context.fillText(phone, (cardWidth - phoneWidth) / 2, 540);

			// Draw UID
			context.font = '20px Poppins';
			context.fillStyle = 'rgba(223, 74, 62, 1)';
			const uidWidth = context.measureText(uid.toString()).width;
			context.fillText(uid.toString(), (cardWidth - uidWidth) / 1.9, 500);

			// Convert to base64
			const buffer = canvas.toBuffer('image/jpeg');
			const base64Image = buffer.toString('base64');

			results.push({ base64: base64Image, name: fullName });
		}

		participantEntry.isDownloaded = true;

		await participantEntry.save();

		res.json({ statusCode: 200, data: results, message: 'Successfully ID Cards Generated' });
	} catch (error) {
		res.json({ statusCode: 400, message: error.message });
	}
});


// async function uploadExcel(filePath) {

// 	// Read Excel file
// 	// Read Excel file
// 	const workbook = XLSX.readFile(filePath);
// 	const sheetName = workbook.SheetNames[0];
// 	let data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

// 	// Add events field to each row
// 	data = data.map((row) => ({
// 		...row,
// 		events: [{ event: "dandiya", year: "2024", registered: true }],
// 	}));

// 	// Batch insert
// 	const BATCH_SIZE = 1000;
// 	for (let i = 0; i < data.length; i += BATCH_SIZE) {
// 		const batch = data.slice(i, i + BATCH_SIZE);
// 		try {
// 			await DandiyaEvent.insertMany(batch, { ordered: false });
// 			console.log(`✅ Uploaded batch ${i / BATCH_SIZE + 1}`);
// 		} catch (err) {
// 			console.error("❌ Error inserting batch:", err);
// 		}
// 	}

// 	console.log("✅ All Excel data uploaded successfully!");
// }

// // Run the function
// uploadExcel("dandiya-2024.xlsx"); // <-- replace with your actual file name

app.listen(3000, () => {
	console.log('Server running on http://localhost:3000');
});
