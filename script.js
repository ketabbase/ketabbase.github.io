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
            addPostButton.style.display = 'flex'; // Use flex to center icon
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
    newPostForm.addEventListener('submit', (event) => {
        event.preventDefault();

        const bookTitle = document.getElementById('book-title').value;
        const bookAuthor = document.getElementById('book-author').value;
        const bookQuote = document.getElementById('book-quote').value;
        const bookCoverFile = document.getElementById('book-cover-upload').files[0];

        let bookCoverSrc = '';
        if (bookCoverFile) {
            // For a real app, you'd upload this and get a URL.
            // For this demo, we'll use a placeholder or data URL (simplified).
            // In a real app, data URLs for large images are not recommended for performance.
            const reader = new FileReader();
            reader.onload = (e) => {
                bookCoverSrc = e.target.result;
                addPostToFeed(bookTitle, bookAuthor, bookQuote, bookCoverSrc);
                newPostForm.reset();
                bookCoverPreview.style.display = 'none';
                bookCoverPreview.src = '#';
                showScreen('feed-screen');
            };
            reader.readAsDataURL(bookCoverFile);
        } else {
            addPostToFeed(bookTitle, bookAuthor, bookQuote, bookCoverSrc);
            newPostForm.reset();
            bookCoverPreview.style.display = 'none';
            bookCoverPreview.src = '#';
            showScreen('feed-screen');
        }
    });

    const addPostToFeed = (title, author, quote, coverSrc) => {
        const newPostCard = document.createElement('div');
        newPostCard.classList.add('post-card');
        newPostCard.innerHTML = `
            <div class="post-header">
                <img src="avatar.png" alt="User Avatar" class="post-avatar">
                <span class="post-username">کاربر کتاب‌گرد (شما)</span>
            </div>
            <div class="post-content">
                ${coverSrc ? `<img src="${coverSrc}" alt="Book Cover" class="book-cover">` : ''}
                <h3 class="book-title">${title}</h3>
                <p class="book-author">نویسنده: ${author}</p>
                <blockquote class="book-quote">"${quote}"</blockquote>
            </div>
            <div class="post-actions">
                <button class="action-button"><span class="material-icons">thumb_up</span> لایک</button>
                <button class="action-button"><span class="material-icons">comment</span> کامنت</button>
            </div>
            <div class="comments-section">
                <!-- Comments would be dynamically added here -->
            </div>
        `;
        postsList.prepend(newPostCard); // Add new post to the top of the feed

        // Also add to profile screen's posts (for this demo)
        const userPostsList = document.querySelector('#profile-screen .user-posts-list');
        const userPostCard = newPostCard.cloneNode(true);
        // Remove user avatar and name from profile screen's own posts if desired, or keep as is
        const userPostHeader = userPostCard.querySelector('.post-header');
        if (userPostHeader) userPostHeader.remove(); // Remove header for own posts in profile
        userPostsList.prepend(userPostCard);
    };

    // Initial screen load
    showScreen('feed-screen');
});