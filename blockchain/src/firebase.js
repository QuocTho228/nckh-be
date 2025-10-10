const admin = require("firebase-admin");
const { initializeApp } = require("firebase/app");
const {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} = require("firebase/storage");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const { getAuth, signInAnonymously } = require("firebase/auth");

// Khởi tạo Firebase Admin SDK
const serviceAccount = {
  type: process.env.FIREBASE_ADMIN_TYPE,
  project_id: process.env.FIREBASE_ADMIN_PROJECT_ID,
  private_key_id: process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
  client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_ADMIN_CLIENT_ID,
  auth_uri: process.env.FIREBASE_ADMIN_AUTH_URI,
  token_uri: process.env.FIREBASE_ADMIN_TOKEN_URI,
  auth_provider_x509_cert_url:
    process.env.FIREBASE_ADMIN_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_ADMIN_CLIENT_X509_CERT_URL,
};

// console.log("Initializing Firebase Admin SDK with service account:", serviceAccount.type);
// console.log("Initializing Firebase Admin SDK with service account:", serviceAccount.project_id);
// console.log("Initializing Firebase Admin SDK with service account:", serviceAccount.private_key);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
});

// Lấy bucket từ Admin SDK
const adminBucket = admin.storage().bucket();

// Khởi tạo Firebase SDK thông thường
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

const firebaseApp = initializeApp(firebaseConfig);
const storage = getStorage(firebaseApp);
const auth = getAuth(firebaseApp);

async function uploadFile(file) {
  const fileName = `avatars/${Date.now()}_${file.originalname}`;
  const fileUpload = adminBucket.file(fileName);

  const blobStream = fileUpload.createWriteStream({
    metadata: {
      contentType: file.mimetype,
    },
  });

  return new Promise((resolve, reject) => {
    blobStream.on("error", (error) => {
      console.error("Lỗi khi upload file:", error);
      reject("Lỗi khi upload file: " + error.message);
    });

    blobStream.on("finish", async () => {
      try {
        const publicUrl = `https://storage.googleapis.com/${adminBucket.name}/${fileUpload.name}`;
        resolve(publicUrl);
      } catch (error) {
        console.error("Lỗi khi lấy URL công khai:", error);
        reject("Lỗi khi lấy URL công khai: " + error.message);
      }
    });

    blobStream.end(file.buffer);
  });
}

async function deleteFile(fileUrl) {
  const fileName = fileUrl.split("/").pop();
  const file = adminBucket.file(`avatars/${fileName}`);

  try {
    await file.delete();
    console.log(`File ${fileName} đã được xóa thành công.`);
  } catch (error) {
    console.error("Lỗi khi xóa file:", error);
    throw error;
  }
}

async function uploadFileFirebase(file) {
  const fileName = `avatars/${Date.now()}_${file.originalname}`;
  const storageRef = ref(storage, fileName);

  const snapshot = await uploadBytes(storageRef, file.buffer, {
    contentType: file.mimetype,
  });

  const url = await getDownloadURL(snapshot.ref);
  return url;
}

async function authenticateAnonymously() {
  try {
    console.log("Bắt đầu xác thực ẩn danh");
    const auth = getAuth(firebaseApp);
    console.log("Auth instance:", auth);
    const userCredential = await signInAnonymously(auth);
    console.log("Xác thực ẩn danh thành công:", userCredential.user.uid);
    return userCredential.user;
  } catch (error) {
    console.error("Lỗi xác thực ẩn danh:", error);
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
    throw error;
  }
}

module.exports = {
  uploadFile,
  deleteFile,
  uploadFileFirebase,
  storage,
  auth,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  admin,
  adminBucket,
  authenticateAnonymously,
};



// const admin = require("firebase-admin");
// const { initializeApp } = require("firebase/app");

// const {
//   getStorage,
//   ref,
//   uploadBytes,
//   getDownloadURL,
//   deleteObject
// } = require("firebase/storage");

// const path = require("path");
// require("dotenv").config({ path: path.resolve(__dirname, "../../.env")});
// console.log("Loading .env from:", path.resolve(__dirname, "../../.env"));
// console.log("Loaded FIREBASE_ADMIN_PRIVATE_KEY:", process.env.FIREBASE_ADMIN_PRIVATE_KEY);
// const { getAuth, signInAnonymously } = require("firebase/auth");

// // Sửa cách xử lý private key
// let privateKey;
// try {
//   if (process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
//     // Decode từ Base64
//     const decodedKey = Buffer.from(process.env.FIREBASE_ADMIN_PRIVATE_KEY, 'base64').toString('utf8');
    
//     // Làm sạch và format lại private key
//     privateKey = decodedKey
//       .replace(/\\n/g, '\n')  // Thay thế \\n thành \n thực
//       .trim();                // Loại bỏ spaces thừa
    
//     console.log("Private key decoded successfully");
//     // Log 50 ký tự đầu để debug (không log toàn bộ vì security)
//     console.log("Private key starts with:", privateKey.substring(0, 50) + "...");
    
//     // Kiểm tra format
//     if (!privateKey.includes('-----BEGIN PRIVATE KEY-----') || 
//         !privateKey.includes('-----END PRIVATE KEY-----')) {
//       throw new Error("Private key format is invalid - missing BEGIN/END markers");
//     }
//   } else {
//     throw new Error("FIREBASE_ADMIN_PRIVATE_KEY not found in environment");
//   }
// } catch (error) {
//   console.error("Error processing private key:", error.message);
//   console.log("Invalid private key in .env file");
//   process.exit(1); // Dừng app nếu private key không hợp lệ
// }

// // Khởi tạo Firebase Admin SDK
// const serviceAccount = {
//   type: process.env.FIREBASE_ADMIN_TYPE,
//   project_id: process.env.FIREBASE_ADMIN_PROJECT_ID,
//   private_key_id: process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID,
//   private_key: privateKey,
//   client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
//   client_id: process.env.FIREBASE_ADMIN_CLIENT_ID,
//   auth_uri: process.env.FIREBASE_ADMIN_AUTH_URI,
//   token_uri: process.env.FIREBASE_ADMIN_TOKEN_URI,
//   auth_provider_x509_cert_url:
//     process.env.FIREBASE_ADMIN_AUTH_PROVIDER_X509_CERT_URL,
//   client_x509_cert_url: process.env.FIREBASE_ADMIN_CLIENT_X509_CERT_URL
// };

// if (admin.apps.length === 0) {
//   try {
//     admin.initializeApp({
//       credential: admin.credential.cert(serviceAccount),
//       storageBucket: process.env.FIREBASE_STORAGE_BUCKET
//     });
//     console.log("Firebase initialized successfully");
//     const bucket = admin.storage().bucket();
//     console.log("Bucket name:", bucket.name);
//   } catch (error) {
//     console.error("Firebase initialization error:", error.message);
//     console.log("Invalid private key in .env file");
//     process.exit(1);
//   }
// } else {
//   console.log("Firebase app already initialized, reusing...");
// }

// // Lấy bucket từ Admin SDK
// const adminBucket = admin.storage().bucket();

// // Kiểm tra xem bucket có hoạt động bình thường sau khi khởi tạo
// (async () => {
//   try {
//     console.log("adminBucket initialized:", adminBucket.name);
//     await adminBucket.getMetadata();
//     console.log("adminBucket is accessible");
//   } catch (error) {
//     console.error("adminBucket access error:", error.message);
//   }
// })();

// // Khởi tạo Firebase SDK thông thường
// const firebaseConfig = {
//   apiKey: process.env.FIREBASE_API_KEY,
//   authDomain: process.env.FIREBASE_AUTH_DOMAIN,
//   projectId: process.env.FIREBASE_PROJECT_ID,
//   storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
//   messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
//   appId: process.env.FIREBASE_APP_ID,
//   measurementId: process.env.FIREBASE_MEASUREMENT_ID
// };

// const firebaseApp = initializeApp(firebaseConfig);
// const storage = getStorage(firebaseApp);
// const auth = getAuth(firebaseApp);

// async function uploadFile(file) {
//   const fileName = `avatars/${Date.now()}_${file.originalname}`;
//   const fileUpload = adminBucket.file(fileName);

//   const blobStream = fileUpload.createWriteStream({
//     metadata: {
//       contentType: file.mimetype
//     }
//   });

//   return new Promise((resolve, reject) => {
//     blobStream.on("error", (error) => {
//       console.error("Lỗi khi upload file:", error);
//       reject("Lỗi khi upload file: " + error.message);
//     });

//     blobStream.on("finish", async () => {
//       try {
//         const publicUrl = `https://storage.googleapis.com/${adminBucket.name}/${fileUpload.name}`;
//         resolve(publicUrl);
//       } catch (error) {
//         console.error("Lỗi khi lấy URL công khai:", error);
//         reject("Lỗi khi lấy URL công khai: " + error.message);
//       }
//     });

//     blobStream.end(file.buffer);
//   });
// }

// async function deleteFile(fileUrl) {
//   const fileName = fileUrl.split("/").pop();
//   const file = adminBucket.file(`avatars/${fileName}`);

//   try {
//     await file.delete();
//     console.log(`File ${fileName} đã được xóa thành công.`);
//   } catch (error) {
//     console.error("Lỗi khi xóa file:", error);
//     throw error;
//   }
// }

// async function uploadFileFirebase(file) {
//   const fileName = `avatars/${Date.now()}_${file.originalname}`;
//   const storageRef = ref(storage, fileName);

//   const snapshot = await uploadBytes(storageRef, file.buffer, {
//     contentType: file.mimetype
//   });

//   const url = await getDownloadURL(snapshot.ref);
//   return url;
// }

// async function authenticateAnonymously() {
//   try {
//     console.log("Bắt đầu xác thực ẩn danh");
//     const auth = getAuth(firebaseApp);
//     console.log("Auth instance:", auth);
//     const userCredential = await signInAnonymously(auth);
//     console.log("Xác thực ẩn danh thành công:", userCredential.user.uid);
//     return userCredential.user;
//   } catch (error) {
//     console.error("Lỗi xác thực ẩn danh:", error);
//     console.error("Error code:", error.code);
//     console.error("Error message:", error.message);
//     throw error;
//   }
// }

// module.exports = {
//   uploadFile,
//   deleteFile,
//   uploadFileFirebase,
//   storage,
//   auth,
//   ref,
//   uploadBytes,
//   getDownloadURL,
//   deleteObject,
//   admin,
//   adminBucket,
//   authenticateAnonymously
// };