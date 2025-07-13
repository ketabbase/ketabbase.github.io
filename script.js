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
    const changePhotoButton = document.getElementById('change-photo-button');
    const profilePhotoUpload = document.getElementById('profile-photo-upload');
    const profileAvatar = document.getElementById('profile-avatar');

    let currentUser = null; // Stores current logged-in user
    let posts = []; // Stores all posts
    let userProfile = null; // Stores user profile data
    let isLoadingPosts = true; // Track if posts are still loading
    let userProfiles = {}; // Stores all user profiles for avatars
    
    // Check for saved auth state
    const savedUser = localStorage.getItem('ketabboard_user');
    if (savedUser) {
        try {
            const userData = JSON.parse(savedUser);
            console.log('Found saved user data:', userData);
        } catch (error) {
            console.error('Error parsing saved user data:', error);
            localStorage.removeItem('ketabboard_user');
        }
    }

    // بارگذاری همه پست‌ها و کامنت‌ها برای همه کاربران (مهمان و لاگین)
    const loadPostsAndComments = () => {
        console.log('Loading posts and comments for all users...');
        console.log('Firebase db available:', !!window.firebase?.db);
        
        // Show loading state immediately
        if (postsList) {
            postsList.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>در حال بارگذاری پست‌ها...</p>
                </div>
            `;
        }
        
        // Try to load posts with timeout
        const loadPostsWithTimeout = () => {
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Firebase connection timeout'));
                }, 15000); // 15 second timeout
                
                try {
                    // Load all user profiles first
                    loadAllUserProfiles().then(async () => {
                        // Wait a bit for userProfile to be loaded if user is logged in
                        if (currentUser) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                        console.log('User profiles loaded, now loading posts...');
                        
                        // Test Firebase connection first
                        console.log('Testing Firebase connection...');
                        try {
                            const testCollection = collection(window.firebase.db, 'test');
                            const testDoc = await addDoc(testCollection, { test: true, timestamp: serverTimestamp() });
                            console.log('Firebase connection test successful, created test doc:', testDoc.id);
                            await deleteDoc(doc(window.firebase.db, 'test', testDoc.id));
                            console.log('Test doc deleted successfully');
                        } catch (testError) {
                            console.error('Firebase connection test failed:', testError);
                        }
                        
                        // Test if posts collection exists
                        console.log('Testing posts collection...');
                        try {
                            const postsCollection = collection(window.firebase.db, 'posts');
                            const postsSnapshot = await getDocs(postsCollection);
                            console.log('Posts collection test - docs count:', postsSnapshot.docs.length);
                            postsSnapshot.forEach(doc => {
                                console.log('Existing post:', doc.id, doc.data());
                            });
                        } catch (postsTestError) {
                            console.error('Posts collection test failed:', postsTestError);
                        }
                        
                        // Load posts with real-time listener
                        const postsQuery = query(collection(window.firebase.db, 'posts'), orderBy('timestamp', 'desc'));
                        console.log('Posts query created:', postsQuery);
                        
                        const unsubscribe = onSnapshot(postsQuery, async (snapshot) => {
                            clearTimeout(timeout);
                            console.log('Posts snapshot received, docs count:', snapshot.docs.length);
                            console.log('Snapshot metadata:', snapshot.metadata);
                            console.log('Snapshot empty:', snapshot.empty);
                            
                            const newPosts = [];
                            for (const doc of snapshot.docs) {
                                const postData = { id: doc.id, ...doc.data() };
                                console.log('Post data:', postData);
                                newPosts.push(postData);
                            }
                            
                            // Update posts immediately
                            posts = newPosts;
                            isLoadingPosts = false;
                            
                            console.log(`Updated posts array with ${newPosts.length} posts`);
                            
                            // Load comments for all posts before rendering
                            await loadCommentsForAllPosts();
                            
                            // Now render posts with comments
                            renderPosts();
                            console.log(`Loaded ${newPosts.length} posts`);
                            resolve();
                        }, (error) => {
                            clearTimeout(timeout);
                            console.error('Error in posts snapshot:', error);
                            reject(error);
                        });
                    }).catch(error => {
                        clearTimeout(timeout);
                        console.error('Error loading user profiles:', error);
                        reject(error);
                    });
                } catch (error) {
                    clearTimeout(timeout);
                    console.error('Error in loadPostsWithTimeout:', error);
                    reject(error);
                }
            });
        };
        
        // Try to load posts, fallback to offline message if failed
        loadPostsWithTimeout().catch(error => {
            console.error('Failed to load posts:', error);
            isLoadingPosts = false;
            
            if (postsList) {
                postsList.innerHTML = `
                    <div class="offline-message">
                        <span class="material-icons" style="font-size: 3em; color: #ff6b6b; margin-bottom: 1rem;">wifi_off</span>
                        <p>خطا در اتصال به سرور</p>
                        <p>لطفاً اتصال اینترنت خود را بررسی کنید و صفحه را refresh کنید.</p>
                        <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">تلاش مجدد</button>
                    </div>
                `;
            }
        });
    };

    const loadCommentsForAllPosts = async () => {
        return new Promise((resolve) => {
            // Set up real-time listener for all comments
            const commentsQuery = query(collection(window.firebase.db, 'comments'));
            onSnapshot(commentsQuery, (snapshot) => {
                const allComments = [];
                snapshot.forEach((commentDoc) => {
                    const commentData = commentDoc.data();
                    allComments.push({
                        id: commentDoc.id,
                        ...commentData,
                        timestamp: commentData.timestamp?.toDate ? commentData.timestamp.toDate() : commentData.timestamp
                    });
                });
                
                // Group comments by postId
                const commentsByPost = {};
                allComments.forEach(comment => {
                    if (!commentsByPost[comment.postId]) {
                        commentsByPost[comment.postId] = [];
                    }
                    commentsByPost[comment.postId].push(comment);
                });
                
                // Sort comments by timestamp for each post
                Object.keys(commentsByPost).forEach(postId => {
                    commentsByPost[postId].sort((a, b) => {
                        const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
                        const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
                        return timeA - timeB;
                    });
                });
                
                // Update posts with comments
                posts.forEach(post => {
                    post.comments = commentsByPost[post.id] || [];
                });
                
                console.log(`Updated comments for all posts`);
                resolve();
            });
        });
    };

    const loadAllUserProfiles = async () => {
        try {
            console.log('Loading all user profiles...');
            const usersRef = collection(window.firebase.db, 'users');
            const snapshot = await getDocs(usersRef);
            
            userProfiles = {};
            snapshot.forEach((doc) => {
                const userData = doc.data();
                userProfiles[userData.uid] = userData;
                console.log(`Loaded profile for ${userData.username || userData.email}:`, userData);
            });
            
            // Add current user if not in userProfiles
            if (currentUser && !userProfiles[currentUser.uid]) {
                userProfiles[currentUser.uid] = {
                    uid: currentUser.uid,
                    username: currentUser.displayName || currentUser.email,
                    photoURL: null,
                    role: 'کاربر'
                };
                console.log('Added current user to userProfiles:', userProfiles[currentUser.uid]);
            }
            
            console.log(`Loaded ${Object.keys(userProfiles).length} user profiles:`, Object.keys(userProfiles));
            console.log('User profiles data:', userProfiles);
            return true;
        } catch (error) {
            console.error('Error loading user profiles:', error);
            return false;
        }
    };

    // Function to show a specific screen
    const showScreen = (screenId) => {
        console.log('Showing screen:', screenId);
        
        // Hide loading screen if showing another screen
        if (screenId !== 'loading-screen') {
            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen) {
                loadingScreen.classList.remove('active');
            }
        }
        
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
        
        // Show feed screen for all users (guest and logged in)
        if (screenId === 'feed-screen') {
            console.log('Showing feed screen, current user:', currentUser ? 'logged in' : 'guest');
            // Render posts if they exist
            if (posts.length > 0 || !isLoadingPosts) {
                renderPosts();
            }
        }

        // Update login/logout button visibility and profile info
        if (currentUser) {
            loginNavButton.style.display = 'none';
            logoutButton.style.display = 'block';
            profileUsername.textContent = currentUser.displayName || currentUser.email;
            profileRole.textContent = userProfile?.role || 'کاربر';
            profileBio.textContent = userProfile?.bio || 'علاقه‌مند به ادبیات کلاسیک و فلسفه';
            editBioButton.style.display = 'flex';
            changePhotoButton.style.display = 'flex';
            if (profileBio.querySelector('textarea')) {
                profileBio.innerHTML = userProfile?.bio || 'علاقه‌مند به ادبیات کلاسیک و فلسفه';
            }
            
            // Update profile photo
            if (userProfile?.photoURL) {
                updateProfilePhoto(userProfile.photoURL);
            } else {
                updateProfilePhoto(null);
            }
        } else {
            loginNavButton.style.display = 'flex';
            logoutButton.style.display = 'none';
            profileUsername.textContent = 'کاربر مهمان';
            profileRole.textContent = 'مهمان';
            profileBio.textContent = 'برای مشاهده و ارسال پست وارد شوید.';
            editBioButton.style.display = 'none';
            changePhotoButton.style.display = 'none';
            updateProfilePhoto(null);
        }

        updateAdminControls();
    };

    // Function to update admin controls
    const updateAdminControls = () => {
        const adminElements = document.querySelectorAll('.admin-only');
        const isAdmin = currentUser && (currentUser.email === 'ketabbase@ketabgard.com' || userProfile?.role === 'admin');
        
        if (isAdmin) {
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

        // Show loading state
        const submitButton = newPostForm.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.textContent;
        submitButton.textContent = 'در حال ارسال...';
        submitButton.disabled = true;

        try {
            let bookCoverURL = '';
            
            if (bookCoverFile) {
                // Convert to base64 to avoid CORS issues
                try {
                    const reader = new FileReader();
                    const base64Promise = new Promise((resolve, reject) => {
                        reader.onload = () => resolve(reader.result);
                        reader.onerror = reject;
                    });
                    reader.readAsDataURL(bookCoverFile);
                    bookCoverURL = await base64Promise;
                    console.log('Image converted to base64 successfully');
                } catch (base64Error) {
                    console.error('Error converting image to base64:', base64Error);
                    alert('خطا در پردازش تصویر. لطفاً بدون تصویر پست را ارسال کنید.');
                    submitButton.textContent = originalButtonText;
                    submitButton.disabled = false;
                    return;
                }
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
        } finally {
            // Reset loading state
            submitButton.textContent = originalButtonText;
            submitButton.disabled = false;
        }
    });

    const renderPosts = () => {
        console.log('renderPosts called with', posts.length, 'posts');
        console.log('Posts data:', posts);
        console.log('isLoadingPosts:', isLoadingPosts);
        console.log('postsList element:', postsList);
        
        // Clear existing posts
        if (postsList) {
            postsList.innerHTML = '';
        }
        const userPostsList = document.querySelector('#profile-screen .user-posts-list');
        if (userPostsList) userPostsList.innerHTML = '';

        if (posts.length === 0) {
            console.log('No posts found, showing appropriate message');
            // Check if we're still loading
            if (isLoadingPosts) {
                console.log('Still loading posts, showing loading state');
                if (postsList) {
                    postsList.innerHTML = `
                        <div class="loading-state">
                            <div class="loading-spinner"></div>
                            <p>در حال بارگذاری پست‌ها...</p>
                        </div>
                    `;
                }
            } else {
                console.log('Not loading, showing no posts message');
                if (postsList) {
                    postsList.innerHTML = `
                        <div class="no-posts">
                            <span class="material-icons" style="font-size: 3em; color: #ccc; margin-bottom: 1rem;">book</span>
                            <p>هنوز هیچ پستی ارسال نشده است!</p>
                            ${currentUser ? '<p>اولین پست خود را ارسال کنید و تجربیات کتابخوانی خود را به اشتراک بگذارید.</p>' : '<p>برای ارسال پست و مشاهده محتوای دیگران وارد شوید.</p>'}
                        </div>
                    `;
                }
            }
            return;
        }

        // Use DocumentFragment for better performance
        const fragment = document.createDocumentFragment();
        const userFragment = document.createDocumentFragment();

        posts.forEach(post => {
            const newPostCard = createPostCard(post);
            fragment.appendChild(newPostCard);

            if (currentUser && post.userId === currentUser.uid) {
                const userPostCard = createPostCard(post, true);
                userFragment.appendChild(userPostCard);
            }
        });

        // Append fragments to DOM (more efficient than individual appends)
        postsList.appendChild(fragment);
        if (userPostsList) userPostsList.appendChild(userFragment);

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
            const userAvatar = createUserAvatar(post.userId, post.username);
            postHeaderHtml = `
                <div class="post-header">
                    <div class="post-avatar">
                        <div class="avatar-placeholder">${userAvatar}</div>
                    </div>
                    <span class="post-username">${post.username}</span>
                    <span class="post-role">(${post.userRole === 'admin' ? 'مدیر' : 'کاربر'})</span>
                </div>
            `;
        }

        const likedByCurrentUser = currentUser && post.likedBy && post.likedBy.includes(currentUser.uid);
        const likeButtonClass = likedByCurrentUser ? 'action-button like-button liked' : 'action-button like-button';

        // Check delete permissions
        const canDeletePost = currentUser && (
            currentUser.email === 'ketabbase@ketabgard.com' || 
            userProfile?.role === 'admin' || 
            post.userId === currentUser.uid
        );
        
        console.log(`Post ${post.id} - Current user: ${currentUser?.email}, User profile role: ${userProfile?.role}, Post author: ${post.userId}, Current user ID: ${currentUser?.uid}, Can delete: ${canDeletePost}`);

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
                ${canDeletePost ? 
                    `<button class="action-button delete-post-button">
                        <span class="material-icons">delete</span> حذف
                    </button>` : ''
                }
            </div>
            <div class="comments-section" style="display: none;">
                <div class="comments-list">
                    ${post.comments ? post.comments.map(comment => {
                        const canDeleteComment = currentUser && (
                            currentUser.email === 'ketabbase@ketabgard.com' || 
                            userProfile?.role === 'admin' || 
                            comment.userId === currentUser.uid
                        );
                        
                        console.log(`Comment ${comment.id} - Can delete: ${canDeleteComment}, Comment author: ${comment.userId}, Current user: ${currentUser?.uid}`);
                        
                        const commentUserAvatar = createUserAvatar(comment.userId, comment.username);
                        return `
                            <div class="comment" data-comment-id="${comment.id}">
                                <div class="comment-header">
                                    <div class="comment-avatar">
                                        <div class="avatar-placeholder small">${commentUserAvatar}</div>
                                    </div>
                                    <div class="comment-info">
                                        <span class="comment-author">${comment.username}</span>
                                        <span class="comment-time">${comment.timestamp ? (comment.timestamp.toDate ? comment.timestamp.toDate().toLocaleString('fa-IR') : comment.timestamp.toLocaleString('fa-IR')) : ''}</span>
                                    </div>
                                </div>
                                <div class="comment-text">${comment.text}</div>
                                ${canDeleteComment ? 
                                    `<button class="delete-comment-button">
                                        <span class="material-icons">close</span>
                                    </button>` : ''
                                }
                            </div>
                        `;
                    }).join('') : ''}
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
        

        
        // Debug info (optional - can be removed)
        if (currentUser) {
            console.log(`Post ${post.id} - Can delete: ${canDeletePost}`);
        }
        

        
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
            console.log('User not logged in, cannot like post');
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
        console.log('Adding comment for post:', postId);
        
        if (!currentUser) {
            console.log('User not logged in, cannot add comment');
            showScreen('login-screen');
            return;
        }
        
        const commentInput = e.target.querySelector('.comment-input');
        const commentText = commentInput.value.trim();
        
        console.log('Comment text:', commentText);
        console.log('Comment input element:', commentInput);
        
        if (!commentText) return;

        // Clear input immediately for better UX
        commentInput.value = '';
        commentInput.focus(); // Keep focus on input
        console.log('Input cleared, new value:', commentInput.value);

        // Optimistic UI update - add comment immediately to local state
        const post = posts.find(p => p.id === postId);
        if (post) {
            const tempCommentId = 'temp-' + Date.now();
            const tempComment = {
                id: tempCommentId,
                postId,
                userId: currentUser.uid,
                username: currentUser.displayName || currentUser.email,
                text: commentText,
                timestamp: new Date()
            };
            
            if (!post.comments) post.comments = [];
            post.comments.push(tempComment);
            
            // Update UI immediately
            const postCard = document.querySelector(`[data-post-id="${postId}"]`);
            if (postCard) {
                const commentsList = postCard.querySelector('.comments-list');
                if (commentsList) {
                    const commentUserAvatar = createUserAvatar(currentUser.uid, tempComment.username);
                    const commentElement = document.createElement('div');
                    commentElement.className = 'comment';
                    commentElement.dataset.commentId = tempCommentId;
                    commentElement.innerHTML = `
                        <div class="comment-header">
                            <div class="comment-avatar">
                                <div class="avatar-placeholder small">${commentUserAvatar}</div>
                            </div>
                            <div class="comment-info">
                                <span class="comment-author">${tempComment.username}</span>
                                <span class="comment-time">${tempComment.timestamp.toLocaleString('fa-IR')}</span>
                            </div>
                        </div>
                        <div class="comment-text">${tempComment.text}</div>
                        <button class="delete-comment-button">
                            <span class="material-icons">close</span>
                        </button>
                    `;
                    
                    // Add event listener for delete button
                    const deleteButton = commentElement.querySelector('.delete-comment-button');
                    if (deleteButton) {
                        deleteButton.addEventListener('click', (e) => {
                            const commentEl = e.target.closest('.comment');
                            if (commentEl) {
                                const commentId = commentEl.dataset.commentId;
                                deleteComment(post.id, commentId);
                            }
                        });
                    }
                    
                    commentsList.appendChild(commentElement);
                    
                    // Update comment count
                    const commentButton = postCard.querySelector('.comment-toggle-button');
                    commentButton.innerHTML = `<span class="material-icons">comment</span> کامنت (${post.comments.length})`;
                    
                    // Show comments section if hidden
                    const commentsSection = postCard.querySelector('.comments-section');
                    if (commentsSection && commentsSection.style.display === 'none') {
                        commentsSection.style.display = 'block';
                    }
                }
            }
        }

        // Save to Firebase
        try {
            console.log('Saving to Firebase...');
            const commentData = {
                postId,
                userId: currentUser.uid,
                username: currentUser.displayName || currentUser.email,
                text: commentText,
                timestamp: serverTimestamp()
            };

            console.log('Comment data for Firebase:', commentData);
            const docRef = await addDoc(collection(window.firebase.db, 'comments'), commentData);
            console.log('Comment saved with ID:', docRef.id);
            
            // Replace temp comment with real comment
            if (post) {
                // Remove temp comment from local state
                post.comments = post.comments.filter(c => c.id !== tempCommentId);
                
                // Add real comment
                const realComment = {
                    id: docRef.id,
                    postId,
                    userId: currentUser.uid,
                    username: currentUser.displayName || currentUser.email,
                    text: commentText,
                    timestamp: commentData.timestamp?.toDate ? commentData.timestamp.toDate() : commentData.timestamp
                };
                post.comments.push(realComment);
                
                // Update UI
                const postCard = document.querySelector(`[data-post-id="${postId}"]`);
                if (postCard) {
                    // Remove temp comment from UI
                    const tempCommentElement = postCard.querySelector(`[data-comment-id="${tempCommentId}"]`);
                    if (tempCommentElement) {
                        tempCommentElement.remove();
                    }
                    
                    // Add real comment to UI
                    const commentsList = postCard.querySelector('.comments-list');
                    if (commentsList) {
                        const commentUserAvatar = createUserAvatar(realComment.userId, realComment.username);
                        const commentElement = document.createElement('div');
                        commentElement.className = 'comment';
                        commentElement.dataset.commentId = realComment.id;
                        commentElement.innerHTML = `
                            <div class="comment-header">
                                <div class="comment-avatar">
                                    <div class="avatar-placeholder small">${commentUserAvatar}</div>
                                </div>
                                <div class="comment-info">
                                    <span class="comment-author">${realComment.username}</span>
                                    <span class="comment-time">${realComment.timestamp?.toLocaleString ? realComment.timestamp.toLocaleString('fa-IR') : ''}</span>
                                </div>
                            </div>
                            <div class="comment-text">${realComment.text}</div>
                            <button class="delete-comment-button">
                                <span class="material-icons">close</span>
                            </button>
                        `;
                        
                        // Add event listener for delete button
                        const deleteButton = commentElement.querySelector('.delete-comment-button');
                        if (deleteButton) {
                            deleteButton.addEventListener('click', (e) => {
                                const commentEl = e.target.closest('.comment');
                                if (commentEl) {
                                    const commentId = commentEl.dataset.commentId;
                                    deleteComment(post.id, commentId);
                                }
                            });
                        }
                        
                        commentsList.appendChild(commentElement);
                    }
                }
            }
            
            // Add animation
            const commentButton = e.target.closest('.post-card').querySelector('.comment-toggle-button');
            commentButton.style.transform = 'scale(1.1)';
            setTimeout(() => {
                commentButton.style.transform = 'scale(1)';
            }, 150);
            
            // Double-check input is cleared
            const currentInput = e.target.querySelector('.comment-input');
            if (currentInput) {
                currentInput.value = '';
                console.log('Final check - input value:', currentInput.value);
            }
            
            // Alternative method: reset the form
            e.target.reset();
            console.log('Form reset completed');
            
        } catch (error) {
            console.error('Error adding comment:', error);
            
            // Remove the optimistic comment if it failed
            if (post) {
                post.comments = post.comments.filter(c => c.id !== tempCommentId);
                
                // Remove from UI
                const postCard = document.querySelector(`[data-post-id="${postId}"]`);
                if (postCard) {
                    const tempCommentElement = postCard.querySelector(`[data-comment-id="${tempCommentId}"]`);
                    if (tempCommentElement) {
                        tempCommentElement.remove();
                    }
                    
                    // Update comment count
                    const commentButton = postCard.querySelector('.comment-toggle-button');
                    commentButton.innerHTML = `<span class="material-icons">comment</span> کامنت (${post.comments.length})`;
                }
            }
            
            // Input already cleared at the beginning
        }
    };

    const deletePost = async (postId) => {
        if (!currentUser) {
            alert('برای حذف پست باید وارد شوید.');
            return;
        }
        
        const post = posts.find(p => p.id === postId);
        if (!post) {
            alert('پست یافت نشد.');
            return;
        }
        
        // Check if user is admin (ketabbase user) or post author
        const isAdmin = currentUser.email === 'ketabbase@ketabgard.com' || userProfile?.role === 'admin';
        const isPostAuthor = post.userId === currentUser.uid;
        
        if (!isAdmin && !isPostAuthor) {
            alert('شما دسترسی حذف این پست را ندارید.');
            return;
        }
        
        if (confirm('آیا مطمئن هستید که می‌خواهید این پست را حذف کنید؟\n\nاین عمل غیرقابل بازگشت است و تمام کامنت‌های مربوطه نیز حذف خواهند شد.')) {
            try {
                // First, delete all comments for this post
                if (post.comments && post.comments.length > 0) {
                    console.log(`Deleting ${post.comments.length} comments for post ${postId}`);
                    const deletePromises = post.comments.map(comment => 
                        deleteDoc(doc(window.firebase.db, 'comments', comment.id))
                    );
                    await Promise.all(deletePromises);
                }
                
                // Then delete the post
                await deleteDoc(doc(window.firebase.db, 'posts', postId));
                console.log(`Post ${postId} deleted successfully by ${isAdmin ? 'admin' : 'author'}`);
            } catch (error) {
                console.error('Error deleting post:', error);
                alert('خطا در حذف پست');
            }
        }
    };

    const deleteComment = async (postId, commentId) => {
        if (!currentUser) {
            console.log('User not logged in, cannot delete comment');
            return;
        }
        
        // Find the comment to check permissions
        const post = posts.find(p => p.id === postId);
        const comment = post?.comments?.find(c => c.id === commentId);
        
        if (!comment) {
            console.log('Comment not found');
            return;
        }
        
        // Check if user is admin (ketabbase user) or comment author
        const isAdmin = currentUser.email === 'ketabbase@ketabgard.com' || userProfile?.role === 'admin';
        const isCommentAuthor = comment.userId === currentUser.uid;
        
        if (!isAdmin && !isCommentAuthor) {
            console.log('User does not have permission to delete this comment');
            return;
        }
        
        if (confirm('آیا مطمئن هستید که می‌خواهید این کامنت را حذف کنید؟')) {
            try {
                await deleteDoc(doc(window.firebase.db, 'comments', commentId));
                console.log(`Comment ${commentId} deleted successfully by ${isAdmin ? 'admin' : 'author'}`);
            } catch (error) {
                console.error('Error deleting comment:', error);
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
                bio: 'عضو جدید کتاب‌بورد هستم!',
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
            localStorage.removeItem('ketabboard_user');
            showScreen('login-screen');
        } catch (error) {
            console.error('Logout error:', error);
            alert('خطا در خروج');
        }
    });

    // Change Profile Photo functionality
    changePhotoButton.addEventListener('click', () => {
        if (!currentUser) return;
        profilePhotoUpload.click();
    });

    profilePhotoUpload.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Check file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            alert('حجم تصویر نباید بیشتر از 5 مگابایت باشد.');
            return;
        }

        try {
            // Show loading state
            changePhotoButton.innerHTML = '<span class="material-icons">hourglass_empty</span>';
            changePhotoButton.disabled = true;

            // Convert to base64
            const reader = new FileReader();
            const base64Promise = new Promise((resolve, reject) => {
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
            });
            reader.readAsDataURL(file);
            const photoURL = await base64Promise;

            // Update UI immediately
            updateProfilePhoto(photoURL);

            // Save to Firestore
            const usersRef = collection(window.firebase.db, 'users');
            const q = query(usersRef, where('uid', '==', currentUser.uid));
            const snapshot = await getDocs(q);
            
            if (!snapshot.empty) {
                const userDoc = snapshot.docs[0];
                await updateDoc(doc(window.firebase.db, 'users', userDoc.id), { 
                    photoURL: photoURL,
                    // Remove old Firebase Storage URL if exists
                    profilePhotoURL: null
                });
                userProfile.photoURL = photoURL;
                userProfile.profilePhotoURL = null; // Clear old URL
            }

            console.log('Profile photo updated successfully with base64');
        } catch (error) {
            console.error('Error updating profile photo:', error);
            alert('خطا در به‌روزرسانی عکس پروفایل');
        } finally {
            // Reset button state
            changePhotoButton.innerHTML = '<span class="material-icons">photo_camera</span>';
            changePhotoButton.disabled = false;
        }
    });

    const updateProfilePhoto = (photoURL) => {
        console.log('Updating profile photo with URL:', photoURL ? photoURL.substring(0, 50) + '...' : 'null');
        
        if (photoURL && photoURL.startsWith('data:image')) {
            // Base64 image - safe to use
            const img = document.createElement('img');
            img.src = photoURL;
            img.alt = 'Profile Photo';
            img.onerror = () => {
                console.error('Failed to load profile image');
                showPlaceholder();
            };
            
            // Clear existing content and add image
            profileAvatar.innerHTML = '';
            profileAvatar.appendChild(img);
            console.log('Base64 image loaded successfully');
        } else if (photoURL && photoURL.startsWith('https://')) {
            // External URL - might have CORS issues
            console.log('External URL detected, trying to load...');
            const img = document.createElement('img');
            img.crossOrigin = 'anonymous';
            img.src = photoURL;
            img.alt = 'Profile Photo';
            img.onerror = () => {
                console.error('Failed to load external image, showing placeholder');
                showPlaceholder();
            };
            img.onload = () => {
                console.log('External image loaded successfully');
            };
            
            // Clear existing content and add image
            profileAvatar.innerHTML = '';
            profileAvatar.appendChild(img);
        } else {
            // No photo or invalid URL - show placeholder
            showPlaceholder();
        }
    };

    const showPlaceholder = () => {
        const initial = (currentUser?.displayName || currentUser?.email || 'U').charAt(0).toUpperCase();
        profileAvatar.innerHTML = initial;
        console.log('Showing placeholder with initial:', initial);
    };

    const createUserAvatar = (userId, username) => {
        // Simple version without userProfile dependency
        const userProfileData = userProfiles[userId];
        
        console.log(`Creating avatar for user ${userId} (${username}):`, userProfileData);
        console.log('Available userProfiles:', Object.keys(userProfiles));
        console.log('userProfiles content:', userProfiles);
        
        if (userProfileData && userProfileData.photoURL) {
            // User has a profile photo (base64 or external URL)
            console.log(`Using profile photo for ${username}:`, userProfileData.photoURL);
            return `<img src="${userProfileData.photoURL}" alt="${username}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
        } else {
            // Show placeholder with user initial
            const initial = (username || 'U').charAt(0).toUpperCase();
            console.log(`Using placeholder for ${username}: ${initial}`);
            return initial;
        }
    };

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
            // Check if user is admin (ketabbase)
            if (currentUser && currentUser.email === 'ketabbase@ketabgard.com') {
                userProfile = { 
                    role: 'admin', 
                    bio: 'مدیر سیستم کتاب‌بورد',
                    username: 'ketabbase'
                };
                console.log('Admin user detected: ketabbase');
                return;
            }
            
            const usersRef = collection(window.firebase.db, 'users');
            const q = query(usersRef, where('uid', '==', uid));
            const snapshot = await getDocs(q);
            
            if (!snapshot.empty) {
                userProfile = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
                
                // Update userProfiles with current user data
                if (currentUser && userProfiles[currentUser.uid]) {
                    userProfiles[currentUser.uid].photoURL = userProfile.photoURL || null;
                    userProfiles[currentUser.uid].role = userProfile.role || 'کاربر';
                    console.log('Updated userProfiles with current user data:', userProfiles[currentUser.uid]);
                }
                
                // Update profile photo if exists (prefer base64 over external URLs)
                if (userProfile.photoURL && userProfile.photoURL.startsWith('data:image')) {
                    console.log('Loading base64 profile photo');
                    updateProfilePhoto(userProfile.photoURL);
                } else if (userProfile.photoURL && userProfile.photoURL.startsWith('https://')) {
                    console.log('External profile photo URL detected, may have CORS issues');
                    // Try to load external URL but fallback to placeholder if it fails
                    updateProfilePhoto(userProfile.photoURL);
                } else {
                    console.log('No profile photo found, showing placeholder');
                    updateProfilePhoto(null);
                }
            } else {
                userProfile = { role: 'کاربر', bio: 'علاقه‌مند به ادبیات کلاسیک و فلسفه' };
                
                // Update userProfiles with default data
                if (currentUser && userProfiles[currentUser.uid]) {
                    userProfiles[currentUser.uid].photoURL = null;
                    userProfiles[currentUser.uid].role = 'کاربر';
                }
                
                updateProfilePhoto(null);
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
            userProfile = { role: 'کاربر', bio: 'علاقه‌مند به ادبیات کلاسیک و فلسفه' };
        }
    };

    // Load posts from Firebase (deprecated - using loadPostsAndComments instead)
    const loadPosts = async () => {
        console.log('loadPosts called - this function is deprecated');
        // This function is kept for backward compatibility but loadPostsAndComments is used instead
    };

    // Function to save user state to localStorage
    const saveUserState = (user) => {
        if (user) {
            const userData = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                timestamp: Date.now()
            };
            localStorage.setItem('ketabboard_user', JSON.stringify(userData));
            console.log('User state saved to localStorage');
        } else {
            localStorage.removeItem('ketabboard_user');
            console.log('User state removed from localStorage');
        }
    };

    // Auth state listener
    onAuthStateChanged(window.firebase.auth, async (user) => {
        console.log('Auth state changed:', user ? 'User logged in' : 'User logged out');
        currentUser = user;
        
        // Save user state to localStorage
        saveUserState(user);
        
        if (user) {
            console.log('Loading user profile...');
            await loadUserProfile(user.uid);
            
            // Debug: Log user status
            console.log('=== USER STATUS ===');
            console.log('User email:', user.email);
            console.log('User UID:', user.uid);
            console.log('User profile:', userProfile);
            console.log('Is admin (email check):', user.email === 'ketabbase@ketabgard.com');
            console.log('Is admin (role check):', userProfile?.role === 'admin');
            console.log('==================');
            
            // Test delete permissions
            setTimeout(() => {
                testDeletePermissions();
            }, 1000);
            
            // Posts and comments are already loaded by loadPostsAndComments for all users
            
            // Test Firebase connection and comment functionality
            console.log('Testing Firebase connection...');
            try {
                const testDoc = await addDoc(collection(window.firebase.db, 'test'), {
                    test: true,
                    timestamp: serverTimestamp()
                });
                console.log('Firebase test successful, doc ID:', testDoc.id);
                // Clean up test document
                await deleteDoc(doc(window.firebase.db, 'test', testDoc.id));
                
                // Test comment collection access
                const commentsSnapshot = await getDocs(collection(window.firebase.db, 'comments'));
                console.log(`Found ${commentsSnapshot.size} existing comments in database`);
                commentsSnapshot.forEach(doc => {
                    console.log('Comment:', doc.id, doc.data());
                });
            } catch (error) {
                console.error('Firebase test failed:', error);
            }
        } else {
            console.log('User logged out, clearing user profile but keeping posts...');
            userProfile = null;
            // Don't clear posts for guest users - they should still see posts
            renderPosts();
        }
        
        // Show appropriate screen based on auth state
        const targetScreen = user ? 'feed-screen' : 'feed-screen'; // Show feed for both logged in and guest users
        console.log('Showing screen:', targetScreen);
        
        // Add a small delay to ensure Firebase auth state is properly initialized
        setTimeout(() => {
            showScreen(targetScreen);
        }, 500);
        
        // Set up periodic comment monitoring (for debugging)
        if (user) {
            setInterval(() => {
                console.log('=== Comment Status Check ===');
                console.log('Total posts:', posts.length);
                posts.forEach(post => {
                    console.log(`Post ${post.id}: ${post.comments ? post.comments.length : 0} comments`);
                    if (post.comments && post.comments.length > 0) {
                        post.comments.forEach(comment => {
                            console.log(`  - Comment ${comment.id}: ${comment.text.substring(0, 30)}...`);
                        });
                    }
                });
                console.log('==========================');
            }, 30000); // Check every 30 seconds
        }
    });

    // Function to check if user should be automatically logged in
    const checkAutoLogin = async () => {
        const savedUser = localStorage.getItem('ketabboard_user');
        if (savedUser) {
            try {
                const userData = JSON.parse(savedUser);
                const now = Date.now();
                const timeDiff = now - userData.timestamp;
                
                // Auto-login if saved within last 24 hours
                if (timeDiff < 24 * 60 * 60 * 1000) {
                    console.log('Attempting auto-login for user:', userData.displayName);
                    
                    // Check if Firebase auth state is already set
                    const currentAuthUser = window.firebase.auth.currentUser;
                    if (!currentAuthUser) {
                        console.log('No current auth user, waiting for Firebase to restore session...');
                    } else {
                        console.log('Firebase auth user already exists:', currentAuthUser.displayName);
                    }
                    
                    return true;
                } else {
                    console.log('Saved user data is too old, removing...');
                    localStorage.removeItem('ketabboard_user');
                }
            } catch (error) {
                console.error('Error checking auto-login:', error);
                localStorage.removeItem('ketabboard_user');
            }
        }
        return false;
    };

    // Wait for Firebase to initialize before setting up auth listener
    const waitForFirebase = async () => {
        if (window.firebase && window.firebase.auth) {
            console.log('Firebase initialized, setting up auth listener...');
            
            // Check for auto-login
            await checkAutoLogin();
            
            // Show feed screen for all users (guest and logged in)
            setTimeout(() => {
                console.log('Showing feed screen for all users');
                showScreen('feed-screen');
            }, 1000); // Wait 1 second for Firebase to restore auth state
            
            // Auth listener is already set up above
        } else {
            console.log('Firebase not ready yet, waiting...');
            setTimeout(waitForFirebase, 100);
        }
    };

    // Function to check current auth state
    const checkCurrentAuthState = () => {
        const auth = window.firebase.auth;
        if (auth) {
            const user = auth.currentUser;
            console.log('Current Firebase auth user:', user ? user.displayName : 'None');
            console.log('Current user email:', user ? user.email : 'None');
            console.log('Current user UID:', user ? user.uid : 'None');
            console.log('User profile:', userProfile);
            return user;
        }
        return null;
    };

    // Function to test delete permissions
    const testDeletePermissions = () => {
        console.log('=== TESTING DELETE PERMISSIONS ===');
        console.log('Current user:', currentUser);
        console.log('User profile:', userProfile);
        
        if (currentUser) {
            console.log('User email:', currentUser.email);
            console.log('User UID:', currentUser.uid);
            console.log('Is ketabbase admin:', currentUser.email === 'ketabbase@ketabgard.com');
            console.log('Is role admin:', userProfile?.role === 'admin');
            
            // Test with a sample post
            if (posts.length > 0) {
                const samplePost = posts[0];
                console.log('Sample post author ID:', samplePost.userId);
                console.log('Can delete sample post:', 
                    currentUser.email === 'ketabbase@ketabgard.com' || 
                    userProfile?.role === 'admin' || 
                    samplePost.userId === currentUser.uid
                );
            }
        }
        console.log('==================================');
    };

    // Start loading posts and comments immediately for all users
    const startLoadingPosts = () => {
        console.log('startLoadingPosts called');
        console.log('Firebase available:', !!window.firebase);
        console.log('Firebase db available:', !!window.firebase?.db);
        
        if (window.firebase && window.firebase.db) {
            console.log('Starting to load posts and comments for all users...');
            loadPostsAndComments();
            
            // Real-time comments listener disabled to prevent duplicates
            // Comments will be loaded through loadPostsAndComments function
            console.log('Real-time comments listener disabled to prevent duplicates');
        } else {
            console.log('Firebase not ready yet, retrying in 100ms...');
            setTimeout(startLoadingPosts, 100);
        }
    };
    
    // Initial setup - start loading posts immediately
    if (window.firebase && window.firebase.db) {
        console.log('Firebase ready, starting to load posts...');
        startLoadingPosts();
    } else {
        console.log('Firebase not ready, waiting...');
        const checkFirebase = () => {
            if (window.firebase && window.firebase.db) {
                console.log('Firebase ready, starting to load posts...');
                startLoadingPosts();
            } else {
                setTimeout(checkFirebase, 100);
            }
        };
        checkFirebase();
    }
    
    // Wait for Firebase to initialize auth
    waitForFirebase();
});