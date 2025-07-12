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

document.addEventListener('DOMContentLoaded', () => {
    const navButtons = document.querySelectorAll('.nav-button');
    const screens = document.querySelectorAll('.screen');
    const addPostButton = document.getElementById('add-post-button');
    const cancelPostButton = document.getElementById('cancel-post-button');
    const newPostForm = document.getElementById('new-post-form');
    const bookCoverUpload = document.getElementById('book-cover-upload');
    const bookCoverPreview = document.getElementById('book-cover-preview');
    const feedScreen = document.getElementById('feed-screen');
    const postsList = feedScreen.querySelector('.posts-list');
    const profileUsername = document.getElementById('profile-username');
    const profileBio = document.getElementById('profile-bio');
    const profileRole = document.getElementById('profile-role');
    const authForm = document.getElementById('auth-form');
    const registerButton = document.getElementById('register-button');
    const logoutButton = document.getElementById('logout-button');
    const loginNavButton = document.getElementById('login-nav-button');
    const editBioButton = document.querySelector('.edit-bio-button');

    let currentUser = null; // Stores current logged-in user
    let posts = []; // Stores all posts
    let userProfile = null; // Stores user profile data

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
        if (screenId === 'feed-screen' && currentUser) {
            addPostButton.style.display = 'flex';
        } else {
            addPostButton.style.display = 'none';
        }

        // Update login/logout button visibility and profile info
        if (currentUser) {
            loginNavButton.style.display = 'none';
            logoutButton.style.display = 'block';
            profileUsername.textContent = currentUser.displayName || currentUser.email;
            profileRole.textContent = userProfile?.role || 'کاربر';
            profileBio.textContent = userProfile?.bio || 'علاقه‌مند به ادبیات کلاسیک و فلسفه';
            editBioButton.style.display = 'flex';
            if (profileBio.querySelector('textarea')) {
                profileBio.innerHTML = userProfile?.bio || 'علاقه‌مند به ادبیات کلاسیک و فلسفه';
            }
        } else {
            loginNavButton.style.display = 'flex';
            logoutButton.style.display = 'none';
            profileUsername.textContent = 'کاربر مهمان';
            profileRole.textContent = 'مهمان';
            profileBio.textContent = 'برای مشاهده و ارسال پست وارد شوید.';
            editBioButton.style.display = 'none';
        }

        updateAdminControls();
    };

    // Function to update admin controls
    const updateAdminControls = () => {
        const adminElements = document.querySelectorAll('.admin-only');
        if (currentUser && userProfile?.role === 'admin') {
            adminElements.forEach(el => el.style.display = 'inline-flex');
        } else {
            adminElements.forEach(el => el.style.display = 'none');
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
        if (currentUser) {
            showScreen('add-post-screen');
        } else {
            alert('لطفاً ابتدا وارد شوید تا بتوانید پست ارسال کنید.');
            showScreen('login-screen');
        }
    });

    // Cancel Post button
    cancelPostButton.addEventListener('click', () => {
        showScreen('feed-screen');
        newPostForm.reset();
        bookCoverPreview.style.display = 'none';
        bookCoverPreview.src = '#';
    });

    // Book Cover Image Preview
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

    // Handle New Post Submission
    newPostForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!currentUser) {
            alert('برای ارسال پست باید وارد شوید.');
            showScreen('login-screen');
            return;
        }

        const bookTitle = document.getElementById('book-title').value;
        const bookAuthor = document.getElementById('book-author').value;
        const bookQuote = document.getElementById('book-quote').value;
        const bookCoverFile = document.getElementById('book-cover-upload').files[0];

        try {
            let bookCoverURL = '';
            
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
                userRole: userProfile?.role || 'کاربر',
                likes: 0,
                likedBy: [],
                comments: [],
                timestamp: serverTimestamp()
            };

            await addDoc(collection(window.firebase.db, 'posts'), postData);
            
            newPostForm.reset();
            bookCoverPreview.style.display = 'none';
            bookCoverPreview.src = '#';
            showScreen('feed-screen');
            
        } catch (error) {
            console.error('Error creating post:', error);
            alert('خطا در ایجاد پست');
        }
    });

    const renderPosts = () => {
        // Clear existing posts
        postsList.innerHTML = '';
        const userPostsList = document.querySelector('#profile-screen .user-posts-list');
        if (userPostsList) userPostsList.innerHTML = '';

        if (posts.length === 0) {
            postsList.innerHTML = `
                <div class="no-posts">
                    <span class="material-icons" style="font-size: 3em; color: #ccc; margin-bottom: 1rem;">book</span>
                    <p>هنوز هیچ پستی وجود ندارد!</p>
                    ${currentUser ? '<p>اولین پست خود را ارسال کنید.</p>' : '<p>برای ارسال پست وارد شوید.</p>'}
                </div>
            `;
            return;
        }

        // Create a Set to track processed posts to avoid duplicates
        const processedPosts = new Set();

        posts.forEach(post => {
            if (!processedPosts.has(post.id)) {
                processedPosts.add(post.id);
                
                const newPostCard = createPostCard(post);
                postsList.appendChild(newPostCard);

                if (currentUser && post.userId === currentUser.uid) {
                    const userPostCard = createPostCard(post, true);
                    if (userPostsList) userPostsList.appendChild(userPostCard);
                }
            }
        });

        if (userPostsList && userPostsList.children.length === 0) {
            userPostsList.innerHTML = `
                <div class="no-posts">
                    <span class="material-icons" style="font-size: 3em; color: #ccc; margin-bottom: 1rem;">post_add</span>
                    <p>هنوز هیچ پستی ارسال نکرده‌اید!</p>
                    <p>اولین پست خود را ارسال کنید.</p>
                </div>
            `;
        }

        updateAdminControls();
    };

    const createPostCard = (post, isProfileView = false) => {
        const postCard = document.createElement('div');
        postCard.classList.add('post-card');
        postCard.dataset.postId = post.id;

        let postHeaderHtml = '';
        if (!isProfileView) {
            postHeaderHtml = `
                <div class="post-header">
                    <div class="post-avatar">
                        <div class="avatar-placeholder">${(post.username || 'U').charAt(0).toUpperCase()}</div>
                    </div>
                    <span class="post-username">${post.username}</span>
                    <span class="post-role">(${post.userRole === 'admin' ? 'مدیر' : 'کاربر'})</span>
                </div>
            `;
        }

        const likedByCurrentUser = currentUser && post.likedBy && post.likedBy.includes(currentUser.uid);
        const likeButtonClass = likedByCurrentUser ? 'action-button like-button liked' : 'action-button like-button';

        postCard.innerHTML = `
            ${postHeaderHtml}
            <div class="post-content">
                ${post.bookCoverURL ? `<img src="${post.bookCoverURL}" alt="Book Cover" class="book-cover">` : ''}
                <h3 class="book-title">${post.bookTitle}</h3>
                <p class="book-author">نویسنده: ${post.bookAuthor}</p>
                <blockquote class="book-quote">"${post.bookQuote}"</blockquote>
            </div>
            <div class="post-actions">
                <button class="${likeButtonClass}">
                    <span class="material-icons">thumb_up</span> لایک (<span class="like-count">${post.likes || 0}</span>)
                </button>
                <button class="action-button comment-toggle-button">
                    <span class="material-icons">comment</span> کامنت (${post.comments ? post.comments.length : 0})
                </button>
                ${currentUser && (userProfile?.role === 'admin' || post.userId === currentUser.uid) ? 
                    `<button class="action-button delete-post-button admin-only" style="display: none;">
                        <span class="material-icons">delete</span> حذف
                    </button>` : ''
                }
            </div>
            <div class="comments-section" style="display: none;">
                <div class="comments-list">
                    ${post.comments ? post.comments.map(comment => `
                        <div class="comment" data-comment-id="${comment.id}">
                            <div class="comment-header">
                                <span class="comment-author">${comment.username}</span>
                                <span class="comment-time">${comment.timestamp ? new Date(comment.timestamp.toDate()).toLocaleString('fa-IR') : ''}</span>
                            </div>
                            <div class="comment-text">${comment.text}</div>
                            ${currentUser && (userProfile?.role === 'admin' || comment.userId === currentUser.uid) ? 
                                `<button class="delete-comment-button admin-only" style="display: none;">
                                    <span class="material-icons">close</span>
                                </button>` : ''
                            }
                        </div>
                    `).join('') : ''}
                </div>
                <form class="add-comment-form">
                    <input type="text" placeholder="نظر خود را بنویسید..." class="comment-input">
                    <button type="submit">ارسال</button>
                </form>
            </div>
        `;

        // Add event listeners for new elements
        postCard.querySelector('.like-button').addEventListener('click', (e) => handleLike(e, post.id));
        postCard.querySelector('.comment-toggle-button').addEventListener('click', (e) => toggleComments(e));
        postCard.querySelector('.add-comment-form').addEventListener('submit', (e) => addComment(e, post.id));
        
        const deletePostButton = postCard.querySelector('.delete-post-button');
        if (deletePostButton) {
            deletePostButton.addEventListener('click', () => deletePost(post.id));
        }
        
        postCard.querySelectorAll('.delete-comment-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const commentEl = e.target.closest('.comment');
                if (commentEl) {
                    const commentId = commentEl.dataset.commentId;
                    deleteComment(post.id, commentId);
                }
            });
        });

        return postCard;
    };

    const handleLike = async (e, postId) => {
        if (!currentUser) {
            alert('برای لایک کردن باید وارد شوید.');
            showScreen('login-screen');
            return;
        }

        const post = posts.find(p => p.id === postId);
        if (!post) return;

        const likedBy = post.likedBy || [];
        const userLiked = likedBy.includes(currentUser.uid);

        // Optimistic UI update - update immediately for better UX
        let newLikes, newLikedBy;

        if (userLiked) {
            // Unlike - remove user from likedBy and decrease likes
            newLikes = (post.likes || 0) - 1;
            newLikedBy = likedBy.filter(uid => uid !== currentUser.uid);
            
            // Update UI immediately - remove liked state
            e.currentTarget.classList.remove('liked');
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.cursor = 'pointer';
        } else {
            // Like - add user to likedBy and increase likes
            newLikes = (post.likes || 0) + 1;
            newLikedBy = [...likedBy, currentUser.uid];
            
            // Update UI immediately - add liked state
            e.currentTarget.classList.add('liked');
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.cursor = 'pointer';
        }

        // Update local state immediately
        post.likes = newLikes;
        post.likedBy = newLikedBy;

        // Update like count immediately
        e.currentTarget.querySelector('.like-count').textContent = newLikes;
        
        // Add a quick animation
        e.currentTarget.style.transform = 'scale(1.1)';
        setTimeout(() => {
            e.currentTarget.style.transform = 'scale(1)';
        }, 150);

        // Update Firebase in background
        try {
            const postRef = doc(window.firebase.db, 'posts', postId);
            await updateDoc(postRef, { 
                likes: newLikes,
                likedBy: newLikedBy
            });
        } catch (error) {
            console.error('Error liking/unliking post:', error);
            // Revert UI changes if Firebase update fails
            if (userLiked) {
                e.currentTarget.classList.add('liked');
                post.likes = (post.likes || 0) + 1;
                post.likedBy = [...newLikedBy, currentUser.uid];
            } else {
                e.currentTarget.classList.remove('liked');
                post.likes = (post.likes || 0) - 1;
                post.likedBy = newLikedBy.filter(uid => uid !== currentUser.uid);
            }
            e.currentTarget.querySelector('.like-count').textContent = post.likes;
        }
    };

    const toggleComments = (e) => {
        const commentsSection = e.currentTarget.closest('.post-card').querySelector('.comments-section');
        if (commentsSection) {
            commentsSection.style.display = commentsSection.style.display === 'none' ? 'block' : 'none';
        }
    };

    const addComment = async (e, postId) => {
        e.preventDefault();
        if (!currentUser) {
            alert('برای ارسال کامنت باید وارد شوید.');
            showScreen('login-screen');
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
            
            // Add a quick animation to the comment button
            const commentButton = e.target.closest('.post-card').querySelector('.comment-toggle-button');
            commentButton.style.transform = 'scale(1.1)';
            setTimeout(() => {
                commentButton.style.transform = 'scale(1)';
            }, 150);
            
        } catch (error) {
            console.error('Error adding comment:', error);
        }
    };

    const deletePost = async (postId) => {
        if (!currentUser || (userProfile?.role !== 'admin' && posts.find(p => p.id === postId)?.userId !== currentUser.uid)) {
            alert('شما دسترسی حذف پست را ندارید.');
            return;
        }
        
        if (confirm('آیا مطمئن هستید که می‌خواهید این پست را حذف کنید؟')) {
            try {
                            await deleteDoc(doc(window.firebase.db, 'posts', postId));
            } catch (error) {
                console.error('Error deleting post:', error);
                alert('خطا در حذف پست');
            }
        }
    };

    const deleteComment = async (postId, commentId) => {
        if (!currentUser || userProfile?.role !== 'admin') {
            alert('شما دسترسی حذف کامنت را ندارید.');
            return;
        }
        
        if (confirm('آیا مطمئن هستید که می‌خواهید این کامنت را حذف کنید؟')) {
            try {
                await deleteDoc(doc(window.firebase.db, 'comments', commentId));
            } catch (error) {
                console.error('Error deleting comment:', error);
                alert('خطا در حذف کامنت');
            }
        }
    };

    // Auth Form Submission (Login/Register)
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const usernameInput = document.getElementById('username').value;
        const passwordInput = document.getElementById('password').value;

        try {
            const userCredential = await signInWithEmailAndPassword(
                window.firebase.auth, 
                usernameInput + '@ketabgard.com', 
                passwordInput
            );
            showScreen('feed-screen');
        } catch (error) {
            console.error('Login error:', error);
            alert('نام کاربری یا رمز عبور اشتباه است.');
        }
    });

    registerButton.addEventListener('click', async () => {
        const usernameInput = document.getElementById('username').value;
        const passwordInput = document.getElementById('password').value;

        if (usernameInput.trim() === '' || passwordInput.trim() === '') {
            alert('نام کاربری و رمز عبور نمی‌توانند خالی باشند.');
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(
                window.firebase.auth, 
                usernameInput + '@ketabgard.com', 
                passwordInput
            );
            
            await updateProfile(userCredential.user, { displayName: usernameInput });
            
            // Create user document in Firestore
            await addDoc(collection(window.firebase.db, 'users'), {
                uid: userCredential.user.uid,
                username: usernameInput,
                email: userCredential.user.email,
                bio: 'عضو جدید کتاب‌گرد هستم!',
                role: 'کاربر',
                createdAt: serverTimestamp()
            });
            
            authForm.reset();
        } catch (error) {
            console.error('Registration error:', error);
            if (error.code === 'auth/email-already-in-use') {
                alert('این نام کاربری قبلاً گرفته شده است.');
            } else {
                alert('خطا در ثبت نام');
            }
        }
    });

    logoutButton.addEventListener('click', async () => {
        try {
            await signOut(window.firebase.auth);
            showScreen('login-screen');
        } catch (error) {
            console.error('Logout error:', error);
            alert('خطا در خروج');
        }
    });

    // Edit Bio functionality
    editBioButton.addEventListener('click', async () => {
        if (!currentUser) return;

        if (profileBio.querySelector('textarea')) {
            // If already in edit mode, save changes
            const newBio = profileBio.querySelector('textarea').value.trim();
            
            try {
                // Update user document in Firestore
                const usersRef = collection(window.firebase.db, 'users');
                const q = query(usersRef, where('uid', '==', currentUser.uid));
                const snapshot = await getDocs(q);
                
                if (!snapshot.empty) {
                    const userDoc = snapshot.docs[0];
                    await updateDoc(doc(window.firebase.db, 'users', userDoc.id), { bio: newBio });
                    userProfile.bio = newBio;
                }
                
                profileBio.innerHTML = newBio;
                editBioButton.innerHTML = '<span class="material-icons">edit</span> ویرایش بیو';
            } catch (error) {
                console.error('Error updating bio:', error);
                alert('خطا در به‌روزرسانی بیو');
            }
        } else {
            // Enter edit mode
            const currentBio = profileBio.textContent;
            profileBio.innerHTML = `<textarea class="bio-edit-input">${currentBio}</textarea>`;
            profileBio.querySelector('textarea').focus();
            editBioButton.innerHTML = '<span class="material-icons">done</span> ذخیره بیو';
        }
    });

    // Load user profile
    const loadUserProfile = async (uid) => {
        try {
            const usersRef = collection(window.firebase.db, 'users');
            const q = query(usersRef, where('uid', '==', uid));
            const snapshot = await getDocs(q);
            
            if (!snapshot.empty) {
                userProfile = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
            } else {
                userProfile = { role: 'کاربر', bio: 'علاقه‌مند به ادبیات کلاسیک و فلسفه' };
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
            userProfile = { role: 'کاربر', bio: 'علاقه‌مند به ادبیات کلاسیک و فلسفه' };
        }
    };

    // Load posts from Firebase
    const loadPosts = async () => {
        try {
            const q = query(collection(window.firebase.db, 'posts'), orderBy('timestamp', 'desc'));
            
            onSnapshot(q, async (snapshot) => {
                const newPosts = [];
                
                for (const doc of snapshot.docs) {
                    const postData = { id: doc.id, ...doc.data() };
                    
                    // Load comments for this post
                    try {
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
                    } catch (commentError) {
                        console.error('Error loading comments for post:', doc.id, commentError);
                        postData.comments = [];
                    }
                    
                    newPosts.push(postData);
                }
                
                // Only update if posts have actually changed
                const postsChanged = JSON.stringify(posts) !== JSON.stringify(newPosts);
                if (postsChanged) {
                    posts = newPosts;
                    renderPosts();
                }
            });
        } catch (error) {
            console.error('Error loading posts:', error);
        }
    };

    // Auth state listener
    onAuthStateChanged(window.firebase.auth, async (user) => {
        currentUser = user;
        
        if (user) {
            await loadUserProfile(user.uid);
            loadPosts();
        } else {
            posts = [];
            userProfile = null;
            renderPosts();
        }
        
        showScreen(user ? 'feed-screen' : 'login-screen');
    });

    // Initial render and screen load
    renderPosts();
    showScreen('login-screen');
});