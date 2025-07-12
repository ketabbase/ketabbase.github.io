// Firebase imports
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    where,
    serverTimestamp,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
    ref,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// Global variables
let currentUser = null;
let posts = [];
let userPosts = [];

// DOM elements
const authForm = document.getElementById('auth-form');
const loginNavButton = document.getElementById('login-nav-button');
const profileUsername = document.getElementById('profile-username');
const profileBio = document.getElementById('profile-bio');
const profileRole = document.getElementById('profile-role');
const logoutButton = document.getElementById('logout-button');
const addPostButton = document.getElementById('add-post-button');
const newPostForm = document.getElementById('new-post-form');
const postsList = document.querySelector('.posts-list');
const userPostsList = document.querySelector('.user-posts-list');

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    setupAuthStateListener();
});

function initializeApp() {
    const navButtons = document.querySelectorAll('.nav-button');
    const screens = document.querySelectorAll('.screen');

    navButtons.forEach(button => {
        if (!button) return;
        button.addEventListener('click', () => {
            const target = button.getAttribute('data-target');
            console.log('Nav button clicked, target:', target);
            
            navButtons.forEach(btn => {
                if (btn && btn.classList) btn.classList.remove('active');
            });
            if (button && button.classList) button.classList.add('active');
            screens.forEach(screen => {
                if (screen && screen.classList) screen.classList.remove('active');
            });
            const targetScreen = document.getElementById(target + '-screen');
            if (targetScreen && targetScreen.classList) targetScreen.classList.add('active');
            
            // بارگذاری مجدد پست‌ها یا پروفایل هنگام سوییچ
            if (target === 'feed-screen') {
                console.log('Loading feed posts...');
                loadPosts();
            }
            if (target === 'profile-screen') {
                console.log('Loading profile data...');
                if (currentUser) {
                    loadUserProfile(currentUser);
                    loadUserPosts();
                } else {
                    console.log('No user logged in, cannot load profile');
                }
            }
        });
    });

    // Add post button
    if (addPostButton) {
        addPostButton.addEventListener('click', () => {
            screens.forEach(screen => {
                if (screen && screen.classList) screen.classList.remove('active');
            });
            const addPostScreen = document.getElementById('add-post-screen');
            if (addPostScreen && addPostScreen.classList) addPostScreen.classList.add('active');
        });
    }

    // Cancel post button
    const cancelPostButton = document.getElementById('cancel-post-button');
    if (cancelPostButton) {
        cancelPostButton.addEventListener('click', () => {
            screens.forEach(screen => {
                if (screen && screen.classList) screen.classList.remove('active');
            });
            const feedScreen = document.getElementById('feed-screen');
            if (feedScreen && feedScreen.classList) feedScreen.classList.add('active');
            const navButtons = document.querySelectorAll('.nav-button');
            navButtons.forEach(btn => {
                if (btn && btn.classList) btn.classList.remove('active');
            });
            if (navButtons[0] && navButtons[0].classList) navButtons[0].classList.add('active');
        });
    }

    // Book cover preview
    const bookCoverUpload = document.getElementById('book-cover-upload');
    const bookCoverPreview = document.getElementById('book-cover-preview');
    if (bookCoverUpload && bookCoverPreview) {
        bookCoverUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    bookCoverPreview.src = e.target.result;
                    bookCoverPreview.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Profile image upload
    const profileImageUpload = document.getElementById('profile-image-upload-profile');
    const changeProfileImageButton = document.getElementById('change-profile-image-button');
    if (changeProfileImageButton && profileImageUpload) {
        changeProfileImageButton.addEventListener('click', () => {
            profileImageUpload.click();
        });
        profileImageUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file && currentUser) {
                try {
                    const storageRef = ref(window.firebase.storage, `profile-images/${currentUser.uid}`);
                    const snapshot = await uploadBytes(storageRef, file);
                    const downloadURL = await getDownloadURL(snapshot.ref);
                    await updateProfile(currentUser, { photoURL: downloadURL });
                    alert('عکس پروفایل با موفقیت تغییر یافت!');
                } catch (error) {
                    console.error('Error uploading profile image:', error);
                    alert('خطا در آپلود عکس پروفایل');
                }
            }
        });
    }
}

function setupEventListeners() {
    // Authentication form
    if (authForm) authForm.addEventListener('submit', handleAuth);

    // Register button
    const registerButton = document.getElementById('register-button');
    if (registerButton && authForm) {
        registerButton.addEventListener('click', () => {
            const submitButton = authForm.querySelector('button[type=\"submit\"]');
            if (submitButton && submitButton.textContent === 'ورود') {
                submitButton.textContent = 'ثبت نام';
                registerButton.textContent = 'ورود';
            } else if (submitButton) {
                submitButton.textContent = 'ورود';
                registerButton.textContent = 'ثبت نام';
            }
        });
    }

    // Logout button
    if (logoutButton) logoutButton.addEventListener('click', handleLogout);

    // New post form
    if (newPostForm) newPostForm.addEventListener('submit', handleNewPost);

    // Edit bio button
    const editBioButton = document.querySelector('.edit-bio-button');
    if (editBioButton) {
        editBioButton.addEventListener('click', () => {
            const newBio = prompt('بیو جدید خود را وارد کنید:');
            if (newBio && currentUser) {
                updateUserBio(newBio);
            }
        });
    }
}

function setupAuthStateListener() {
    onAuthStateChanged(window.firebase.auth, (user) => {
        currentUser = user;
        updateUIForAuthState(user);

        if (user) {
            loadUserProfile(user);
            loadPosts();
            loadUserPosts();
        } else {
            posts = [];
            userPosts = [];
            renderPosts();
            renderUserPosts();
        }
    });
}

function updateUIForAuthState(user) {
    console.log('Updating UI for auth state, user:', user ? user.email : 'null');
    const screens = document.querySelectorAll('.screen');
    if (user) {
        if (loginNavButton) loginNavButton.style.display = 'none';
        if (profileUsername) {
            profileUsername.textContent = user.displayName || user.email;
            console.log('Profile username updated to:', profileUsername.textContent);
        }
        if (profileRole) profileRole.textContent = 'کاربر';

        if (user.email === 'admin@ketabgard.com') {
            if (profileRole) profileRole.textContent = 'مدیر';
            document.querySelectorAll('.admin-only').forEach(el => {
                if (el) el.style.display = 'block';
            });
        }
        screens.forEach(screen => {
            if (screen && screen.classList) screen.classList.remove('active');
        });
        const feedScreen = document.getElementById('feed-screen');
        if (feedScreen && feedScreen.classList) feedScreen.classList.add('active');
    } else {
        if (loginNavButton) loginNavButton.style.display = 'block';
        if (profileUsername) {
            profileUsername.textContent = 'کاربر کتاب‌گرد';
            console.log('Profile username reset to default');
        }
        if (profileRole) profileRole.textContent = 'کاربر';

        document.querySelectorAll('.admin-only').forEach(el => {
            if (el) el.style.display = 'none';
        });
        screens.forEach(screen => {
            if (screen && screen.classList) screen.classList.remove('active');
        });
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen && loginScreen.classList) loginScreen.classList.add('active');
    }
}

async function handleAuth(e) {
    e.preventDefault();
    const username = document.getElementById('username')?.value;
    const password = document.getElementById('password')?.value;
    const isRegistering = e.target.querySelector('button[type=\"submit\"]').textContent === 'ثبت نام';

    try {
        if (isRegistering) {
            const userCredential = await createUserWithEmailAndPassword(
                window.firebase.auth,
                username + '@ketabgard.com',
                password
            );
            await updateProfile(userCredential.user, { displayName: username });
            await addDoc(collection(window.firebase.db, 'users'), {
                uid: userCredential.user.uid,
                username: username,
                email: userCredential.user.email,
                bio: 'علاقه‌مند به ادبیات کلاسیک و فلسفه',
                role: 'کاربر',
                createdAt: serverTimestamp()
            });
            alert('حساب کاربری با موفقیت ایجاد شد!');
        } else {
            await signInWithEmailAndPassword(
                window.firebase.auth,
                username + '@ketabgard.com',
                password
            );
            alert('ورود موفقیت‌آمیز بود!');
        }
        if (authForm) authForm.reset();
        const feedScreen = document.getElementById('feed-screen');
        if (feedScreen && feedScreen.classList) feedScreen.classList.add('active');
        const screens = document.querySelectorAll('.screen');
        screens.forEach(screen => {
            if (screen && screen.classList) screen.classList.remove('active');
        });
        const feedNavButton = document.querySelector('[data-target=\"feed-screen\"]');
        if (feedNavButton && feedNavButton.classList) feedNavButton.classList.add('active');
    } catch (error) {
        alert('خطا: ' + getPersianErrorMessage(error.code));
    }
}

function getPersianErrorMessage(errorCode) {
    const errorMessages = {
        'auth/user-not-found': 'کاربری با این نام کاربری یافت نشد',
        'auth/wrong-password': 'رمز عبور اشتباه است',
        'auth/email-already-in-use': 'این نام کاربری قبلاً استفاده شده است',
        'auth/weak-password': 'رمز عبور باید حداقل ۶ کاراکتر باشد',
        'auth/invalid-email': 'نام کاربری نامعتبر است'
    };
    return errorMessages[errorCode] || 'خطای نامشخص';
}

async function handleLogout() {
    try {
        await signOut(window.firebase.auth);
        alert('خروج موفقیت‌آمیز بود!');
    } catch (error) {
        alert('خطا در خروج');
    }
}

async function handleNewPost(e) {
    e.preventDefault();
    if (!currentUser) {
        alert('لطفاً ابتدا وارد شوید');
        return;
    }
    const bookTitle = document.getElementById('book-title')?.value;
    const bookAuthor = document.getElementById('book-author')?.value;
    const bookQuote = document.getElementById('book-quote')?.value;
    const bookCoverFile = document.getElementById('book-cover-upload')?.files[0];
    try {
        let bookCoverURL = null;
        if (bookCoverFile) {
            const storageRef = ref(window.firebase.storage, `book-covers/${Date.now()}_${bookCoverFile.name}`);
            const snapshot = await uploadBytes(storageRef, bookCoverFile);
            bookCoverURL = await getDownloadURL(snapshot.ref);
        }
        const postData = {
            bookTitle,
            bookAuthor,
            bookQuote,
            bookCoverURL,
            userId: currentUser.uid,
            username: currentUser.displayName || currentUser.email,
            userRole: currentUser.email === 'admin@ketabgard.com' ? 'مدیر' : 'کاربر',
            likes: 0,
            timestamp: serverTimestamp()
        };
        await addDoc(collection(window.firebase.db, 'posts'), postData);
        if (newPostForm) newPostForm.reset();
        const bookCoverPreview = document.getElementById('book-cover-preview');
        if (bookCoverPreview) bookCoverPreview.style.display = 'none';
        const feedScreen = document.getElementById('feed-screen');
        if (feedScreen && feedScreen.classList) feedScreen.classList.add('active');
        const screens = document.querySelectorAll('.screen');
        screens.forEach(screen => {
            if (screen && screen.classList) screen.classList.remove('active');
        });
        const feedNavButton = document.querySelector('[data-target=\"feed-screen\"]');
        if (feedNavButton && feedNavButton.classList) feedNavButton.classList.add('active');
        alert('پست با موفقیت منتشر شد!');
    } catch (error) {
        alert('خطا در ایجاد پست');
    }
}

async function loadPosts() {
    try {
        const q = query(collection(window.firebase.db, 'posts'), orderBy('timestamp', 'desc'));
        onSnapshot(q, (snapshot) => {
            posts = [];
            snapshot.forEach((doc) => {
                posts.push({ id: doc.id, ...doc.data() });
            });
            renderPosts();
        });
    } catch (error) {
        // silent
    }
}

async function loadUserProfile(user) {
    console.log('Loading user profile for:', user.uid);
    try {
        const usersRef = collection(window.firebase.db, 'users');
        const q = query(usersRef, where('uid', '==', user.uid));
        const snapshot = await getDocs(q);
        console.log('User profile query result:', snapshot.size, 'documents found');
        
        if (!snapshot.empty) {
            const userData = snapshot.docs[0].data();
            console.log('User data found:', userData);
            if (profileBio) {
                profileBio.textContent = userData.bio || 'علاقه‌مند به ادبیات کلاسیک و فلسفه';
                console.log('Profile bio updated:', profileBio.textContent);
            }
            if (profileRole) {
                profileRole.textContent = userData.role || 'کاربر';
                console.log('Profile role updated:', profileRole.textContent);
            }
        } else {
            console.log('No user document found, creating default profile');
            // Create user document if it doesn't exist
            await addDoc(collection(window.firebase.db, 'users'), {
                uid: user.uid,
                username: user.displayName || user.email,
                email: user.email,
                bio: 'علاقه‌مند به ادبیات کلاسیک و فلسفه',
                role: 'کاربر',
                createdAt: serverTimestamp()
            });
            if (profileBio) profileBio.textContent = 'علاقه‌مند به ادبیات کلاسیک و فلسفه';
            if (profileRole) profileRole.textContent = 'کاربر';
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
    }
}

async function loadUserPosts() {
    if (!currentUser) return;
    try {
        const q = query(
            collection(window.firebase.db, 'posts'),
            orderBy('timestamp', 'desc')
        );
        onSnapshot(q, (snapshot) => {
            userPosts = [];
            snapshot.forEach((doc) => {
                const post = { id: doc.id, ...doc.data() };
                if (post.userId === currentUser.uid) {
                    userPosts.push(post);
                }
            });
            renderUserPosts();
        });
    } catch (error) {
        // silent
    }
}

function renderPosts() {
    if (!postsList) return;
    if (posts.length === 0) {
        postsList.innerHTML = '<div class="no-posts">هیچ پستی وجود ندارد.</div>';
        return;
    }
    postsList.innerHTML = posts.map(post => `
        <div class="post-card" data-post-id="${post.id}">
            <div class="post-header">
                <img src="${post.userPhotoURL || 'avatar.png'}" alt="User Avatar" class="post-avatar">
                <span class="post-username">${post.username}</span>
                <span class="post-role">(${post.userRole})</span>
            </div>
            <div class="post-content">
                <img src="${post.bookCoverURL || 'book_cover_example.png'}" alt="Book Cover" class="book-cover">
                <h3 class="book-title">${post.bookTitle}</h3>
                <p class="book-author">نویسنده: ${post.bookAuthor}</p>
                <blockquote class="book-quote">"${post.bookQuote}"</blockquote>
            </div>
        </div>
    `).join('');
}

function renderUserPosts() {
    if (!userPostsList) return;
    if (userPosts.length === 0) {
        userPostsList.innerHTML = '<div class="no-posts">شما هنوز پستی ثبت نکرده‌اید.</div>';
        return;
    }
    userPostsList.innerHTML = userPosts.map(post => `
        <div class="post-card" data-post-id="${post.id}">
            <div class="post-content">
                <img src="${post.bookCoverURL || 'book_cover_example_2.png'}" alt="Book Cover" class="book-cover">
                <h3 class="book-title">${post.bookTitle}</h3>
                <p class="book-author">نویسنده: ${post.bookAuthor}</p>
                <blockquote class="book-quote">"${post.bookQuote}"</blockquote>
            </div>
        </div>
    `).join('');
}

window.handleLike = async function(postId) {
    if (!currentUser) {
        alert('لطفاً ابتدا وارد شوید');
        return;
    }
    try {
        const postRef = doc(window.firebase.db, 'posts', postId);
        const post = posts.find(p => p.id === postId);
        const newLikes = (post.likes || 0) + 1;
        await updateDoc(postRef, { likes: newLikes });
    } catch (error) {
        alert('خطا در لایک کردن');
    }
};

window.toggleComments = function(postId) {
    const commentsSection = document.getElementById(`comments-${postId}`);
    if (commentsSection) {
        commentsSection.style.display = commentsSection.style.display === 'none' ? 'block' : 'none';
    }
};

window.addComment = async function(e, postId) {
    e.preventDefault();
    if (!currentUser) {
        alert('لطفاً ابتدا وارد شوید');
        return;
    }
    const commentInput = e.target.querySelector('.comment-input');
    const commentText = commentInput.value.trim();
    if (!commentText) return;
    try {
        const commentData = {
            postId,
            userId: currentUser.uid,
            username: currentUser.displayName || currentUser.email,
            text: commentText,
            timestamp: serverTimestamp()
        };
        await addDoc(collection(window.firebase.db, 'comments'), commentData);
        commentInput.value = '';
    } catch (error) {
        alert('خطا در افزودن کامنت');
    }
};

window.deletePost = async function(postId) {
    if (!currentUser) return;
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    if (post.userId !== currentUser.uid && currentUser.email !== 'admin@ketabgard.com') {
        alert('شما مجاز به حذف این پست نیستید');
        return;
    }
    if (confirm('آیا مطمئن هستید که می‌خواهید این پست را حذف کنید؟')) {
        try {
            await deleteDoc(doc(window.firebase.db, 'posts', postId));
            alert('پست با موفقیت حذف شد!');
        } catch (error) {
            alert('خطا در حذف پست');
        }
    }
};

async function updateUserBio(newBio) {
    if (!currentUser) return;
    try {
        const usersRef = collection(window.firebase.db, 'users');
        const q = query(usersRef, where('uid', '==', currentUser.uid));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            const userDoc = snapshot.docs[0];
            await updateDoc(doc(window.firebase.db, 'users', userDoc.id), { bio: newBio });
            if (profileBio) profileBio.textContent = newBio;
            alert('بیو با موفقیت به‌روزرسانی شد!');
        } else {
            await addDoc(collection(window.firebase.db, 'users'), {
                uid: currentUser.uid,
                username: currentUser.displayName || currentUser.email,
                email: currentUser.email,
                bio: newBio,
                role: 'کاربر',
                createdAt: serverTimestamp()
            });
            if (profileBio) profileBio.textContent = newBio;
            alert('بیو با موفقیت به‌روزرسانی شد!');
        }
    } catch (error) {
        alert('خطا در به‌روزرسانی بیو');
    }
}