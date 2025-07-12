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
const profilePicture = document.getElementById('profile-picture');
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

    // Function to show a specific screen
    const showScreen = (screenId) => {
        screens.forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');

        // Update active nav button
        navButtons.forEach(button => {
            if (button.dataset.target === screenId) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });

        // Show/hide FAB based on screen
        if (screenId === 'feed-screen') {
            addPostButton.style.display = 'flex';
        } else {
            addPostButton.style.display = 'none';
        }
    };

    // Navigation buttons functionality
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            showScreen(button.dataset.target);
        });
    });

    // FAB - Add Post button
    addPostButton.addEventListener('click', () => {
        showScreen('add-post-screen');
    });

    // Cancel Post button
    const cancelPostButton = document.getElementById('cancel-post-button');
    cancelPostButton.addEventListener('click', () => {
        showScreen('feed-screen');
        newPostForm.reset();
        const bookCoverPreview = document.getElementById('book-cover-preview');
        bookCoverPreview.style.display = 'none';
        bookCoverPreview.src = '#';
    });

    // Book Cover Image Preview
    const bookCoverUpload = document.getElementById('book-cover-upload');
    const bookCoverPreview = document.getElementById('book-cover-preview');
    bookCoverUpload.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                bookCoverPreview.src = e.target.result;
                bookCoverPreview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        } else {
            bookCoverPreview.style.display = 'none';
            bookCoverPreview.src = '#';
        }
    });

    // Profile image upload
    const profileImageUpload = document.getElementById('profile-image-upload');
    const changeProfileImageButton = document.getElementById('change-profile-image-button');
    
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
                profilePicture.src = downloadURL;
                alert('عکس پروفایل با موفقیت تغییر یافت!');
            } catch (error) {
                console.error('Error uploading profile image:', error);
                alert('خطا در آپلود عکس پروفایل');
            }
        }
    });
}

function setupEventListeners() {
    // Authentication form
    authForm.addEventListener('submit', handleAuth);
    
    // Register button
    const registerButton = document.getElementById('register-button');
    registerButton.addEventListener('click', () => {
        const submitButton = authForm.querySelector('button[type="submit"]');
        if (submitButton.textContent === 'ورود') {
            submitButton.textContent = 'ثبت نام';
            registerButton.textContent = 'ورود';
        } else {
            submitButton.textContent = 'ورود';
            registerButton.textContent = 'ثبت نام';
        }
    });

    // Logout button
    logoutButton.addEventListener('click', handleLogout);

    // New post form
    newPostForm.addEventListener('submit', handleNewPost);

    // Edit bio button
    const editBioButton = document.querySelector('.edit-bio-button');
    editBioButton.addEventListener('click', () => {
        const newBio = prompt('بیو جدید خود را وارد کنید:');
        if (newBio && currentUser) {
            updateUserBio(newBio);
        }
    });
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
    const screens = document.querySelectorAll('.screen');
    if (user) {
        // User is signed in
        loginNavButton.style.display = 'none';
        profileUsername.textContent = user.displayName || user.email;
        profileRole.textContent = 'کاربر';
        
        // Show admin features if user is admin
        if (user.email === 'admin@ketabgard.com') {
            profileRole.textContent = 'مدیر';
        }
        
        // Show feed screen
        screens.forEach(screen => screen.classList.remove('active'));
        document.getElementById('feed-screen').classList.add('active');
    } else {
        // User is signed out
        loginNavButton.style.display = 'block';
        profileUsername.textContent = 'کاربر کتاب‌گرد';
        profileRole.textContent = 'کاربر';
        
        // Show login screen
        screens.forEach(screen => screen.classList.remove('active'));
        document.getElementById('login-screen').classList.add('active');
    }
}

async function handleAuth(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const isRegistering = e.target.querySelector('button[type="submit"]').textContent === 'ثبت نام';
    
    try {
        if (isRegistering) {
            // Register new user
            const userCredential = await createUserWithEmailAndPassword(
                window.firebase.auth, 
                username + '@ketabgard.com', 
                password
            );
            
            await updateProfile(userCredential.user, { displayName: username });
            
            // Create user document in Firestore
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
            await signInWithEmailAndPassword(
                window.firebase.auth, 
                username + '@ketabgard.com', 
                password
            );
            alert('ورود موفقیت‌آمیز بود!');
        }
        
        // Clear form and switch to feed
        authForm.reset();
        document.getElementById('feed-screen').classList.add('active');
        document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
        document.querySelector('[data-target="feed-screen"]').classList.add('active');
        
    } catch (error) {
        console.error('Auth error:', error);
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
    
    const bookTitle = document.getElementById('book-title').value;
    const bookAuthor = document.getElementById('book-author').value;
    const bookQuote = document.getElementById('book-quote').value;
    const bookCoverFile = document.getElementById('book-cover-upload').files[0];
    
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
        
        // Clear form
        newPostForm.reset();
        document.getElementById('book-cover-preview').style.display = 'none';
        
        // Switch to feed
        document.getElementById('feed-screen').classList.add('active');
        document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
        document.querySelector('[data-target="feed-screen"]').classList.add('active');
        
        alert('پست با موفقیت منتشر شد!');
        
    } catch (error) {
        console.error('Error creating post:', error);
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
        console.error('Error loading posts:', error);
    }
}

async function loadUserProfile(user) {
    try {
        const usersRef = collection(window.firebase.db, 'users');
        const q = query(usersRef, where('uid', '==', user.uid));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            const userData = snapshot.docs[0].data();
            profileBio.textContent = userData.bio || 'علاقه‌مند به ادبیات کلاسیک و فلسفه';
            profileRole.textContent = userData.role || 'کاربر';
        }
        
        // Update profile picture if available
        if (user.photoURL) {
            profilePicture.src = user.photoURL;
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
                ${post.bookCoverURL ? `<img src="${post.bookCoverURL}" alt="Book Cover" class="book-cover">` : ''}
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
                    `<button class="action-button delete-post-button" onclick="deletePost('${post.id}')">
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
    
    if (userPosts.length === 0) {
        userPostsList.innerHTML = '<div class="no-posts">شما هنوز پستی ثبت نکرده‌اید.</div>';
        return;
    }
    
    userPostsList.innerHTML = userPosts.map(post => `
        <div class="post-card" data-post-id="${post.id}">
            <div class="post-content">
                ${post.bookCoverURL ? `<img src="${post.bookCoverURL}" alt="Book Cover" class="book-cover">` : ''}
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
            profileBio.textContent = newBio;
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
            profileBio.textContent = newBio;
            alert('بیو با موفقیت به‌روزرسانی شد!');
        }
    } catch (error) {
        console.error('Error updating bio:', error);
        alert('خطا در به‌روزرسانی بیو');
    }
}