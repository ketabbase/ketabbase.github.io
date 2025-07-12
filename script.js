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
                profilePicture.innerHTML = `<img src="${downloadURL}" alt="Profile Picture">`;
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
        
        // Update profile picture
        if (user.photoURL) {
            profilePicture.innerHTML = `<img src="${user.photoURL}" alt="Profile Picture">`;
        } else {
            const username = user.displayName || user.email || 'U';
            profilePicture.innerHTML = `<div class="avatar-placeholder large">${username.charAt(0).toUpperCase()}</div>`;
        }
        
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
        
        // Reset profile picture to default
        profilePicture.innerHTML = '<div class="avatar-placeholder large">ک</div>';
        
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
            likedBy: [],
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
        
        onSnapshot(q, async (snapshot) => {
            posts = [];
            for (const doc of snapshot.docs) {
                const postData = { id: doc.id, ...doc.data() };
                
                // Load comments for this post
                const commentsQuery = query(
                    collection(window.firebase.db, 'comments'),
                    where('postId', '==', doc.id),
                    orderBy('timestamp', 'asc')
                );
                
                const commentsSnapshot = await getDocs(commentsQuery);
                const comments = [];
                commentsSnapshot.forEach((commentDoc) => {
                    comments.push({ id: commentDoc.id, ...commentDoc.data() });
                });
                
                postData.comments = comments;
                posts.push(postData);
            }
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
            profilePicture.innerHTML = `<img src="${user.photoURL}" alt="Profile Picture">`;
        } else {
            const username = user.displayName || user.email || 'U';
            profilePicture.innerHTML = `<div class="avatar-placeholder large">${username.charAt(0).toUpperCase()}</div>`;
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
        postsList.innerHTML = '<div class="no-posts">هنوز هیچ پستی منتشر نشده است. اولین پست خود را ایجاد کنید!</div>';
        return;
    }
    
    postsList.innerHTML = posts.map(post => `
        <div class="post-card" data-post-id="${post.id}">
            <div class="post-header">
                <div class="post-avatar">
                    ${post.userPhotoURL ? 
                        `<img src="${post.userPhotoURL}" alt="User Avatar">` : 
                        `<div class="avatar-placeholder">${(post.username || 'U').charAt(0).toUpperCase()}</div>`
                    }
                </div>
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
                <button class="action-button like-button ${hasUserLikedPost(post, currentUser?.uid) ? 'liked' : ''}" 
                        onclick="handleLike('${post.id}')"
                        ${hasUserLikedPost(post, currentUser?.uid) ? 'disabled' : ''}>
                    <span class="material-icons">thumb_up</span> لایک (<span class="like-count">${post.likes || 0}</span>)
                </button>
                <button class="action-button comment-toggle-button" onclick="toggleComments('${post.id}')">
                    <span class="material-icons">comment</span> کامنت (${post.comments ? post.comments.length : 0})
                </button>
                ${currentUser && (currentUser.email === 'admin@ketabgard.com' || post.userId === currentUser.uid) ? 
                    `<button class="action-button delete-post-button" onclick="deletePost('${post.id}')">
                        <span class="material-icons">delete</span> حذف
                    </button>` : ''
                }
            </div>
            <div class="comments-section" id="comments-${post.id}" style="display: none;">
                <div class="comments-list">
                    ${post.comments ? post.comments.map(comment => `
                        <div class="comment">
                            <div class="comment-header">
                                <span class="comment-author">${comment.username}</span>
                                <span class="comment-time">${comment.timestamp ? new Date(comment.timestamp.toDate()).toLocaleString('fa-IR') : ''}</span>
                            </div>
                            <div class="comment-text">${comment.text}</div>
                            ${currentUser && (currentUser.email === 'admin@ketabgard.com' || comment.userId === currentUser.uid) ? 
                                `<button class="delete-comment-button" onclick="deleteComment('${comment.id}')">
                                    <span class="material-icons">delete</span>
                                </button>` : ''
                            }
                        </div>
                    `).join('') : ''}
                </div>
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
        userPostsList.innerHTML = '<div class="no-posts">شما هنوز پستی ثبت نکرده‌اید. روی دکمه + کلیک کنید تا اولین پست خود را ایجاد کنید!</div>';
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
                <button class="action-button like-button ${hasUserLikedPost(post, currentUser?.uid) ? 'liked' : ''}" 
                        onclick="handleLike('${post.id}')"
                        ${hasUserLikedPost(post, currentUser?.uid) ? 'disabled' : ''}>
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

// Helper function to check if user has liked a post
function hasUserLikedPost(post, userId) {
    if (!post || !userId) return false;
    if (!post.likedBy || !Array.isArray(post.likedBy)) return false;
    return post.likedBy.includes(userId);
}

// Global functions for event handlers
window.handleLike = async function(postId) {
    if (!currentUser || !currentUser.uid) {
        alert('لطفاً ابتدا وارد شوید');
        return;
    }
    
    try {
        const postRef = doc(window.firebase.db, 'posts', postId);
        const post = posts.find(p => p.id === postId);
        
        if (!post) {
            console.error('Post not found:', postId);
            return;
        }
        
        // بررسی دقیق‌تر لایک‌های قبلی
        const userLiked = hasUserLikedPost(post, currentUser.uid);
        
        console.log('User ID:', currentUser.uid);
        console.log('Post likedBy:', post.likedBy);
        console.log('User already liked:', userLiked);
        
        // اگر کاربر قبلاً لایک کرده، اجازه لایک مجدد ندهیم
        if (userLiked) {
            alert('شما قبلاً این پست را لایک کرده‌اید!');
            return;
        }
        
        // فقط لایک کردن (بدون unlike)
        const currentLikedBy = Array.isArray(post.likedBy) ? post.likedBy : [];
        const newLikes = (post.likes || 0) + 1;
        const newLikedBy = [...currentLikedBy, currentUser.uid];
        
        console.log('New likes count:', newLikes);
        console.log('New liked by array:', newLikedBy);
        
        await updateDoc(postRef, { 
            likes: newLikes,
            likedBy: newLikedBy
        });
        
        // Update local state immediately for better UX
        post.likes = newLikes;
        post.likedBy = newLikedBy;
        
        // Update the button appearance
        const likeButton = document.querySelector(`[onclick="handleLike('${postId}')"]`);
        if (likeButton) {
            likeButton.classList.add('liked');
            likeButton.disabled = true;
            likeButton.style.opacity = '0.7';
            likeButton.style.cursor = 'not-allowed';
            likeButton.onclick = null; // حذف event handler
            
            const likeCount = likeButton.querySelector('.like-count');
            if (likeCount) {
                likeCount.textContent = newLikes;
            }
        }
        
        // نمایش پیام موفقیت
        const successMsg = document.createElement('div');
        successMsg.className = 'like-success';
        successMsg.textContent = 'پست با موفقیت لایک شد!';
        successMsg.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        document.body.appendChild(successMsg);
        
        setTimeout(() => {
            successMsg.remove();
        }, 2000);
        
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
        
        const commentRef = await addDoc(collection(window.firebase.db, 'comments'), commentData);
        
        // Add comment to local state for immediate display
        const newComment = {
            id: commentRef.id,
            ...commentData,
            timestamp: new Date()
        };
        
        const post = posts.find(p => p.id === postId);
        if (post) {
            if (!post.comments) post.comments = [];
            post.comments.push(newComment);
            
            // Update comment count in button
            const commentButton = document.querySelector(`[onclick="toggleComments('${postId}')"]`);
            if (commentButton) {
                const commentText = commentButton.textContent.replace(/کامنت \(\d+\)/, `کامنت (${post.comments.length})`);
                commentButton.innerHTML = `<span class="material-icons">comment</span> ${commentText.split('کامنت ')[1]}`;
            }
        }
        
        commentInput.value = '';
        
        // Show success message
        const successMsg = document.createElement('div');
        successMsg.className = 'comment-success';
        successMsg.textContent = 'کامنت با موفقیت اضافه شد!';
        e.target.appendChild(successMsg);
        
        setTimeout(() => {
            successMsg.remove();
        }, 2000);
        
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

window.deleteComment = async function(commentId) {
    if (!currentUser) return;
    
    if (confirm('آیا مطمئن هستید که می‌خواهید این کامنت را حذف کنید؟')) {
        try {
            await deleteDoc(doc(window.firebase.db, 'comments', commentId));
            alert('کامنت با موفقیت حذف شد!');
        } catch (error) {
            console.error('Error deleting comment:', error);
            alert('خطا در حذف کامنت');
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