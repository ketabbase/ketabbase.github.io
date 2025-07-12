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
// Add null check for all event listeners

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    setupAuthStateListener();
});

function initializeApp() {
    // Navigation functionality
    const navButtons = document.querySelectorAll('.nav-button');
    const screens = document.querySelectorAll('.screen');

    console.log('navButtons:', navButtons);

    navButtons.forEach(button => {
        if (!button) return;
        button.addEventListener('click', () => {
            const target = button.getAttribute('data-target');
            // Update active nav button
            navButtons.forEach(btn => {
                if (btn && btn.classList) btn.classList.remove('active');
            });
            if (button && button.classList) button.classList.add('active');
            // Show target screen
            screens.forEach(screen => {
                if (screen && screen.classList) screen.classList.remove('active');
            });
            const targetScreen = document.getElementById(target + '-screen');
            console.log('Clicked nav button, target:', target, 'targetScreen:', targetScreen);
            if (targetScreen && targetScreen.classList) targetScreen.classList.add('active');
        });
    });

    // Add post button
    if (addPostButton) {
        addPostButton.addEventListener('click', () => {
            screens.forEach(screen => {
                if (screen) screen.classList.remove('active');
            });
            const addPostScreen = document.getElementById('add-post-screen');
            if (addPostScreen) addPostScreen.classList.add('active');
        });
    }

    // Cancel post button
    const cancelPostButton = document.getElementById('cancel-post-button');
    if (cancelPostButton) {
        cancelPostButton.addEventListener('click', () => {
            screens.forEach(screen => {
                if (screen) screen.classList.remove('active');
            });
            const feedScreen = document.getElementById('feed-screen');
            if (feedScreen) feedScreen.classList.add('active');
            if (navButtons[0]) navButtons[0].classList.add('active');
            navButtons.forEach(btn => {
                if (btn) btn.classList.remove('active');
            });
            if (navButtons[0]) navButtons[0].classList.add('active');
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
            const submitButton = authForm.querySelector('button[type="submit"]');
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
    console.log('Setting up auth state listener...');
    onAuthStateChanged(window.firebase.auth, (user) => {
        console.log('Auth state changed:', user ? 'User logged in' : 'User logged out');
        currentUser = user;
        updateUIForAuthState(user);
        
        if (user) {
            console.log('Loading user data for:', user.email);
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
    const screens = document.querySelectorAll('.screen');
    if (user) {
        // User is signed in
        if (loginNavButton) loginNavButton.style.display = 'none';
        if (profileUsername) profileUsername.textContent = user.displayName || user.email;
        if (profileRole) profileRole.textContent = 'کاربر';

        // Show admin features if user is admin
        if (user.email === 'admin@ketabgard.com') {
            if (profileRole) profileRole.textContent = 'مدیر';
            document.querySelectorAll('.admin-only').forEach(el => {
                if (el) el.style.display = 'block';
            });
        }
        // Show feed screen
        screens.forEach(screen => {
            if (screen) screen.classList.remove('active');
        });
        const feedScreen = document.getElementById('feed-screen');
        if (feedScreen) feedScreen.classList.add('active');
    } else {
        // User is signed out
        if (loginNavButton) loginNavButton.style.display = 'block';
        if (profileUsername) profileUsername.textContent = 'کاربر کتاب‌گرد';
        if (profileRole) profileRole.textContent = 'کاربر';

        // Hide admin features
        document.querySelectorAll('.admin-only').forEach(el => {
            if (el) el.style.display = 'none';
        });
        // Show login screen
        screens.forEach(screen => {
            if (screen) screen.classList.remove('active');
        });
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) loginScreen.classList.add('active');
    }
}

async function handleAuth(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const isRegistering = e.target.querySelector('button[type="submit"]').textContent === 'ثبت نام';
    
    console.log('Attempting auth:', isRegistering ? 'register' : 'login', 'for username:', username);
    
    try {
        if (isRegistering) {
            // Register new user
            console.log('Creating user with email:', username + '@ketabgard.com');
            const userCredential = await createUserWithEmailAndPassword(
                window.firebase.auth, 
                username + '@ketabgard.com', 
                password
            );
            
            console.log('User created successfully:', userCredential.user.uid);
            await updateProfile(userCredential.user, { displayName: username });
            
            // Create user document in Firestore
            console.log('Creating user document in Firestore...');
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
            // Sign in existing user
            console.log('Signing in user with email:', username + '@ketabgard.com');
            await signInWithEmailAndPassword(
                window.firebase.auth, 
                username + '@ketabgard.com', 
                password
            );
            alert('ورود موفقیت‌آمیز بود!');
        }
        
        // Clear form and switch to feed
        authForm.reset();
        const feedScreen = document.getElementById('feed-screen');
        if (feedScreen) feedScreen.classList.add('active');
        screens.forEach(screen => {
            if (screen) screen.classList.remove('active');
        });
        const feedNavButton = document.querySelector('[data-target="feed-screen"]');
        if (feedNavButton) feedNavButton.classList.add('active');
        
    } catch (error) {
        console.error('Auth error details:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
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
        console.error('Logout error:', error);
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
        console.log('Attempting to add post:', postData);
        await addDoc(collection(window.firebase.db, 'posts'), postData);
        // Clear form
        if (newPostForm) newPostForm.reset();
        const bookCoverPreview = document.getElementById('book-cover-preview');
        if (bookCoverPreview) bookCoverPreview.style.display = 'none';
        // Switch to feed
        const feedScreen = document.getElementById('feed-screen');
        const screens = document.querySelectorAll('.screen');
        if (feedScreen) feedScreen.classList.add('active');
        screens.forEach(screen => {
            if (screen) screen.classList.remove('active');
        });
        const feedNavButton = document.querySelector('[data-target="feed-screen"]');
        if (feedNavButton) feedNavButton.classList.add('active');
        alert('پست با موفقیت منتشر شد!');
    } catch (error) {
        console.error('Error creating post:', error);
        alert('خطا در ایجاد پست');
    }
}

async function loadPosts() {
    console.log('Loading posts...');
    try {
        const q = query(collection(window.firebase.db, 'posts'), orderBy('timestamp', 'desc'));
        console.log('Query created, setting up snapshot listener...');
        
        onSnapshot(q, (snapshot) => {
            console.log('Posts snapshot received, documents count:', snapshot.size);
            posts = [];
            snapshot.forEach((doc) => {
                posts.push({ id: doc.id, ...doc.data() });
            });
            console.log('Posts loaded:', posts.length);
            renderPosts();
        }, (error) => {
            console.error('Error in posts snapshot:', error);
        });
    } catch (error) {
        console.error('Error loading posts:', error);
    }
}

async function loadUserProfile(user) {
    try {
        const usersRef = collection(window.firebase.db, 'users');
        const q = query(usersRef, orderBy('uid'), where('uid', '==', user.uid));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            const userData = snapshot.docs[0].data();
            if (profileBio) profileBio.textContent = userData.bio || 'علاقه‌مند به ادبیات کلاسیک و فلسفه';
            if (profileRole) profileRole.textContent = userData.role || 'کاربر';
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
        console.error('Error loading user posts:', error);
    }
}

function renderPosts() {
    if (!postsList) return;
    
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
            <div class="post-actions">
                <button class="action-button like-button" onclick="handleLike('${post.id}')">
                    <span class="material-icons">thumb_up</span> لایک (<span class="like-count">${post.likes || 0}</span>)
                </button>
                <button class="action-button comment-toggle-button" onclick="toggleComments('${post.id}')">
                    <span class="material-icons">comment</span> کامنت
                </button>
                ${currentUser && (currentUser.email === 'admin@ketabgard.com' || post.userId === currentUser.uid) ? 
                    `<button class="action-button delete-post-button admin-only" onclick="deletePost('${post.id}')">
                        <span class="material-icons">delete</span> حذف
                    </button>` : ''
                }
            </div>
            <div class="comments-section" id="comments-${post.id}" style="display: none;">
                <form class="add-comment-form" onsubmit="addComment(event, '${post.id}')">
                    <input type="text" placeholder="نظر خود را بنویسید..." class="comment-input" required>
                    <button type="submit">ارسال</button>
                </form>
            </div>
        </div>
    `).join('');
}

function renderUserPosts() {
    if (!userPostsList) return;
    
    userPostsList.innerHTML = userPosts.map(post => `
        <div class="post-card" data-post-id="${post.id}">
            <div class="post-content">
                <img src="${post.bookCoverURL || 'book_cover_example_2.png'}" alt="Book Cover" class="book-cover">
                <h3 class="book-title">${post.bookTitle}</h3>
                <p class="book-author">نویسنده: ${post.bookAuthor}</p>
                <blockquote class="book-quote">"${post.bookQuote}"</blockquote>
            </div>
            <div class="post-actions">
                <button class="action-button like-button" onclick="handleLike('${post.id}')">
                    <span class="material-icons">thumb_up</span> لایک (<span class="like-count">${post.likes || 0}</span>)
                </button>
                <button class="action-button comment-toggle-button" onclick="toggleComments('${post.id}')">
                    <span class="material-icons">comment</span> کامنت
                </button>
                <button class="action-button delete-post-button" onclick="deletePost('${post.id}')">
                    <span class="material-icons">delete</span> حذف
                </button>
            </div>
            <div class="comments-section" id="comments-${post.id}" style="display: none;">
                <form class="add-comment-form" onsubmit="addComment(event, '${post.id}')">
                    <input type="text" placeholder="نظر خود را بنویسید..." class="comment-input" required>
                    <button type="submit">ارسال</button>
                </form>
            </div>
        </div>
    `).join('');
}

// Global functions for event handlers
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
        console.error('Error liking post:', error);
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
        console.error('Error adding comment:', error);
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
            console.error('Error deleting post:', error);
            alert('خطا در حذف پست');
        }
    }
};

async function updateUserBio(newBio) {
    if (!currentUser) return;
    
    try {
        // Find user document
        const usersRef = collection(window.firebase.db, 'users');
        const q = query(usersRef, where('uid', '==', currentUser.uid));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            const userDoc = snapshot.docs[0];
            await updateDoc(doc(window.firebase.db, 'users', userDoc.id), { bio: newBio });
            if (profileBio) profileBio.textContent = newBio;
            alert('بیو با موفقیت به‌روزرسانی شد!');
        } else {
            // Create user document if it doesn't exist
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
        console.error('Error updating bio:', error);
        alert('خطا در به‌روزرسانی بیو');
    }
}