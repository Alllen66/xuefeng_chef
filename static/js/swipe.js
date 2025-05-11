document.addEventListener('DOMContentLoaded', () => {
    const cardStack = document.querySelector('.card-stack');
    const likeBtn = document.getElementById('like-btn');
    const dislikeBtn = document.getElementById('dislike-btn');
    const cardPlaceholder = document.querySelector('.card-placeholder');
    const apiUrl = cardStack.dataset.apiUrl; 

    // 移除旧的图标状态变量
    // const initialLikeIcon = '❤️'; 
    // const pressedLikeIcon = '💖';
    // const initialDislikeIcon = '👎';
    // const pressedDislikeIcon = '🚫';

    let recipes = [];
    let currentIndex = 0;
    const cardsToPreload = 3; // 预加载的卡片数量
    const LIKED_RECIPES_STORAGE_KEY = 'likedRecipes'; // localStorage 的键名

    // Helper function to get liked recipes from localStorage
    function getLikedRecipes() {
        const storedRecipes = localStorage.getItem(LIKED_RECIPES_STORAGE_KEY);
        return storedRecipes ? JSON.parse(storedRecipes) : {}; // 使用对象存储，以菜品ID为键
    }

    // Helper function to save a recipe to liked recipes in localStorage
    function saveLikedRecipe(recipeData) {
        const likedRecipes = getLikedRecipes();
        // 存储关键信息，避免存储过多或循环引用
        likedRecipes[recipeData.id] = {
            id: recipeData.id,
            name: recipeData.fields['菜名'] || '未知菜名',
            imageUrl: getRecipeImageUrl(recipeData.fields), // 使用一个辅助函数获取图片
            rating: recipeData.fields['评分'] || null,
            cookingTime: recipeData.fields['烹饪时间'] || '未知'
        };
        localStorage.setItem(LIKED_RECIPES_STORAGE_KEY, JSON.stringify(likedRecipes));
        console.log("Saved liked recipe:", recipeData.id, likedRecipes[recipeData.id]);
    }

    // Helper function to get a valid image URL from recipe fields
    function getRecipeImageUrl(fields) {
        const defaultImageUrl = '/static/images/default_food.png';
        let imageUrl = defaultImageUrl;
        if (fields && fields['图片链接'] && Array.isArray(fields['图片链接']) && fields['图片链接'].length > 0) {
            const firstUrl = fields['图片链接'][0];
            if (typeof firstUrl === 'string' && firstUrl.trim() !== '') {
                imageUrl = firstUrl.trim();
            }
        }
        return imageUrl;
    }


    // 获取所有菜谱数据
    async function fetchRecipes() {
        console.log("Attempting to fetch recipes from:", apiUrl); // 修改：使用 apiUrl
        try {
            const response = await fetch(apiUrl); // <-- 修改这里，使用 apiUrl 变量
            console.log("Fetch response status:", response.status); 
            if (!response.ok) {
                console.error("Fetch response not OK:", response); // 新增
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log("Fetched data:", data); // 新增
            if (data.items && data.items.length > 0) { // <-- MODIFIED HERE: Changed data.records to data.items
                recipes = shuffleArray(data.items);    // <-- MODIFIED HERE: Changed data.records to data.items
                console.log("Recipes loaded and shuffled:", recipes.length, "items"); // 新增
                return true;
            }
            console.log("No records found or empty data."); // 新增
            return false;
        } catch (error) {
            console.error("Error fetching recipes:", error);
            if (cardPlaceholder) cardPlaceholder.textContent = '加载美食失败，请稍后再试。';
            return false;
        }
    }

    // Fisher-Yates (aka Knuth) Shuffle算法
    function shuffleArray(array) {
        let currentIndex = array.length, randomIndex;
        while (currentIndex != 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
        }
        return array;
    }
    
    // 创建卡片元素
    function createCardElement(recipeData) {
        const card = document.createElement('div');
        card.classList.add('swipe-card');
        card.dataset.id = recipeData.id; // 存储菜谱ID

        const fields = recipeData.fields;
        const imageUrl = getRecipeImageUrl(fields); // 从辅助函数获取图片URL

        // 在此定义 defaultImageUrl 以便在 onerror 中使用
        const defaultImageUrl = '/static/images/default_food.png'; 

        let ratingHtml = '暂无评分';
        if (fields['评分']) {
            const numericRating = parseFloat(fields['评分']);
            if (!isNaN(numericRating)) {
                ratingHtml = '';
                for (let i = 1; i <= 5; i++) {
                    if (i <= numericRating) ratingHtml += '❤️'; // 实心红心
                    else if (i - 0.5 <= numericRating) ratingHtml += '🧡'; // 半心（橙心或特定半心符号）
                    else ratingHtml += '🤍'; // 空心（白心或轮廓心）
                }
                ratingHtml += ` (${numericRating.toFixed(1)})`;
            }
        }

        card.innerHTML = `
            <div class="swipe-card-image-container">
                <img src="${imageUrl}" alt="${fields['菜名'] || '美食图片'}" onerror="this.onerror=null;this.src='${defaultImageUrl}';">
            </div>
            <div class="swipe-card-info">
                <h3>${fields['菜名'] || '未知菜名'}</h3>
                <p class="tags">${fields['口味'] && Array.isArray(fields['口味']) ? fields['口味'].map(tag => `<span class="tag">${tag}</span>`).join(' ') : '暂无标签'}</p>
                <p class="rating">${ratingHtml}</p>
                <p>烹饪时间: ${fields['烹饪时间'] || '未知'}</p>
            </div>
            <div class="swipe-card-overlay like">喜欢</div>
            <div class="swipe-card-overlay dislike">不喜欢</div>
        `;
        return card;
    }

    // 修改 handleSwipeAction 函数
    // 此函数现在只负责应用动画和在动画结束后移除卡片
    function handleSwipeAction(cardElement, action) {
        const recipeId = cardElement.dataset.id;
        console.log(`Recipe ID: ${recipeId}, Action: ${action}`);
        // TODO: 在这里可以发送用户偏好到后端

        cardElement.style.zIndex = 0; // 将飞出卡片的 z-index 降低，防止覆盖新卡片
        
        switch (action) {
            case 'like':
                cardElement.classList.add('swipe-out-right');
                break;
            case 'dislike':
                cardElement.classList.add('swipe-out-left');
                break;
            case 'up': // 上滑出
                cardElement.classList.add('swipe-out-up');
                break;
            case 'down': // 下滑出
                cardElement.classList.add('swipe-out-down');
                break;
        }
        
        // 动画结束后移除卡片
        setTimeout(() => {
            if (cardElement) {
                cardElement.remove();
            }
        }, 300); // 对应 CSS 中的动画时长
    }

    // 初始化 Hammer.js 并添加到卡片
    function initSwipe(cardElement) {
        const hammer = new Hammer(cardElement);
        const likeOverlay = cardElement.querySelector('.swipe-card-overlay.like');
        const dislikeOverlay = cardElement.querySelector('.swipe-card-overlay.dislike');
        // 可以为上滑/下滑添加新的 overlay，如果需要的话
        // const nextOverlay = cardElement.querySelector('.swipe-card-overlay.next');
        // const prevOverlay = cardElement.querySelector('.swipe-card-overlay.prev');


        hammer.on('panstart', () => {
            cardElement.classList.add('panning');
        });

        hammer.on('panmove', (ev) => {
            // 卡片跟随手指移动，并根据水平移动轻微旋转
            cardElement.style.transform = `translate(${ev.deltaX}px, ${ev.deltaY}px) rotate(${ev.deltaX / 20}deg)`;
            
            const absDeltaX = Math.abs(ev.deltaX);
            const absDeltaY = Math.abs(ev.deltaY);

            // 根据主要移动方向显示覆盖提示
            if (absDeltaX > absDeltaY) { // 主要是水平移动
                if (ev.deltaX > 0) { // 右滑 - 喜欢
                    likeOverlay.style.opacity = Math.min(absDeltaX / 100, 1);
                    dislikeOverlay.style.opacity = 0;
                } else { // 左滑 - 不喜欢
                    dislikeOverlay.style.opacity = Math.min(absDeltaX / 100, 1);
                    likeOverlay.style.opacity = 0;
                }
            } else { // 主要是垂直移动
                // 可以在这里显示上/下滑的 overlay
                // if (ev.deltaY > 0 && nextOverlay) nextOverlay.style.opacity = Math.min(absDeltaY / 100, 1);
                // else if (ev.deltaY < 0 && prevOverlay) prevOverlay.style.opacity = Math.min(absDeltaY / 100, 1);
                likeOverlay.style.opacity = 0;
                dislikeOverlay.style.opacity = 0;
            }
        });

        hammer.on('panend', (ev) => {
            cardElement.classList.remove('panning');
            if (likeOverlay) likeOverlay.style.opacity = 0;
            if (dislikeOverlay) dislikeOverlay.style.opacity = 0;
            // if (nextOverlay) nextOverlay.style.opacity = 0;
            // if (prevOverlay) prevOverlay.style.opacity = 0;

            const absDeltaX = Math.abs(ev.deltaX);
            const absDeltaY = Math.abs(ev.deltaY);
            const swipeThresholdHorizontal = cardElement.offsetWidth * 0.35; 
            const swipeThresholdVertical = cardElement.offsetHeight * 0.25; 

            let swipedHorizontally = absDeltaX > swipeThresholdHorizontal && absDeltaX > absDeltaY;
            let swipedVertically = absDeltaY > swipeThresholdVertical && absDeltaY > absDeltaX;

            if (swipedHorizontally) {
                const direction = ev.deltaX > 0 ? 'like' : 'dislike';
                
                likeBtn.disabled = true;
                dislikeBtn.disabled = true;
                if (direction === 'like') {
                    likeBtn.setAttribute('aria-pressed', 'true');
                    // 保存喜欢的菜品 (通过滑动)
                    const recipeId = cardElement.dataset.id;
                    const recipeData = recipes.find(r => r.id === recipeId);
                    if (recipeData) {
                        saveLikedRecipe(recipeData);
                    }
                } else {
                    dislikeBtn.setAttribute('aria-pressed', 'true');
                }

                handleSwipeAction(cardElement, direction);

                setTimeout(() => {
                    loadNextCard();
                    setTimeout(() => {
                        likeBtn.setAttribute('aria-pressed', 'false');
                        dislikeBtn.setAttribute('aria-pressed', 'false');
                        likeBtn.disabled = false;
                        dislikeBtn.disabled = false;
                    }, 350); 
                }, 500);

            } else if (swipedVertically) {
                const verticalDirection = ev.deltaY > 0 ? 'down' : 'up'; // 'down' 表示向下, 'up' 表示向上
                
                likeBtn.disabled = true;
                dislikeBtn.disabled = true;

                handleSwipeAction(cardElement, verticalDirection);

                // 对于垂直滑动（上/下），我们在卡片飞出动画后直接加载下一张卡片
                // 按钮状态（aria-pressed）不改变，因为这不是喜欢/不喜欢操作
                setTimeout(() => {
                    loadNextCard(); // 上滑和下滑都加载下一个
                    likeBtn.disabled = false;
                    dislikeBtn.disabled = false;
                }, 350); // 略大于卡片飞出动画时长

            } else {
                // 未达到阈值，卡片归位
                cardElement.style.transform = '';
            }
        });
    }

    // 加载下一张卡片
    function loadNextCard() {
        // 如果存在卡片占位符，先移除它
        const existingCardPlaceholder = cardStack.querySelector('.card-placeholder');
        if (existingCardPlaceholder) {
            existingCardPlaceholder.remove();
        }

        if (currentIndex < recipes.length) {
            const newCardElement = createCardElement(recipes[currentIndex]);
            cardStack.appendChild(newCardElement);
            initSwipe(newCardElement); // 为新卡片初始化滑动事件

            const allCardsInStack = Array.from(cardStack.querySelectorAll('.swipe-card'));
            
            // 根据卡片在堆栈中的位置设置样式
            allCardsInStack.forEach((card, i) => {
                // depth: 0 是最顶层的卡片, 1 是下一张，以此类推
                const depth = allCardsInStack.length - 1 - i; 
                
                card.style.zIndex = recipes.length - depth; // 顶层卡片 z-index 最高
                
                if (depth === 0) { // 最顶层的卡片
                    card.style.transform = 'translateY(0px) scale(1)';
                    card.style.opacity = '1';
                    card.style.pointerEvents = 'auto'; // 允许交互
                } else if (depth < cardsToPreload) { // 预加载的可见卡片 (在顶层卡片之下)
                    card.style.transform = `translateY(${depth * 8}px) scale(${1 - depth * 0.04})`; 
                    card.style.opacity = `${1 - depth * 0.15}`; // 越靠下的卡片越透明
                    card.style.pointerEvents = 'auto'; // 通常预加载的卡片也允许交互，或设为 'none'
                } else { // 更深层的、不应立即看到的卡片
                    card.style.transform = `translateY(${depth * 8}px) scale(${1 - depth * 0.04})`;
                    card.style.opacity = '0'; // 完全透明
                    card.style.pointerEvents = 'none'; // 不允许交互
                }
            });
            currentIndex++;
        } else {
            // 当没有更多菜谱时，并且卡片堆栈中已无卡片，显示提示
            if (!cardStack.querySelector('.swipe-card')) {
                const noMoreEl = document.createElement('div');
                noMoreEl.classList.add('card-placeholder');
                noMoreEl.textContent = '没有更多美食啦！';
                cardStack.appendChild(noMoreEl);
            }
        }
    }
    
    // 初始加载
    async function init() {
        console.log("Initializing swipe page..."); 
        const success = await fetchRecipes();
        console.log("Fetch recipes success status:", success); 
        if (success && recipes.length > 0) {
            // cardPlaceholder 的移除已移至 loadNextCard 内部
            for (let i = 0; i < Math.min(cardsToPreload, recipes.length); i++) {
                loadNextCard();
            }
        } else if (success && recipes.length === 0) {
             // 确保获取到正确的 placeholder 元素进行更新
             let ph = cardStack.querySelector('.card-placeholder');
             if (!ph && cardPlaceholder) ph = cardPlaceholder; // Fallback to the initially captured one

             if (ph) {
                ph.textContent = '暂时没有美食可以推荐哦。';
                if (!cardStack.contains(ph)) { // 如果初始的placeholder被移除了，重新添加
                    cardStack.appendChild(ph);
                }
             }
        }
        // 如果 fetchRecipes 失败，错误信息已在 fetchRecipes 中处理

        likeBtn.addEventListener('click', () => {
            const topCard = cardStack.querySelector('.swipe-card:last-child'); 
            if (topCard && !likeBtn.disabled) { 
                likeBtn.setAttribute('aria-pressed', 'true'); 
                likeBtn.disabled = true;    
                dislikeBtn.disabled = true; 

                // 保存喜欢的菜品 (通过按钮点击)
                const recipeId = topCard.dataset.id;
                const recipeData = recipes.find(r => r.id === recipeId);
                if (recipeData) {
                    saveLikedRecipe(recipeData);
                }

                handleSwipeAction(topCard, 'like'); 

                // 等待 0.5 秒后加载下一张卡片
                setTimeout(() => {
                    loadNextCard(); // 加载新卡片，其相关的堆叠动画约 300-350ms
                    
                    // 在新卡片加载动画完成后再恢复按钮状态
                    setTimeout(() => {
                        likeBtn.setAttribute('aria-pressed', 'false'); // 恢复 aria-pressed 状态
                        likeBtn.disabled = false;   
                        dislikeBtn.disabled = false;
                    }, 350); // 这个延迟应大致等于 loadNextCard 中卡片堆叠动画的持续时间

                }, 500); // 用户要求的0.5秒延迟加载下一道菜
            }
        });

        dislikeBtn.addEventListener('click', () => {
            const topCard = cardStack.querySelector('.swipe-card:last-child');
            if (topCard && !dislikeBtn.disabled) {
                dislikeBtn.setAttribute('aria-pressed', 'true'); // 更新 aria-pressed 状态
                dislikeBtn.disabled = true;   
                likeBtn.disabled = true;      

                handleSwipeAction(topCard, 'dislike'); // 卡片飞出动画约 300ms

                // 等待 0.5 秒后加载下一张卡片
                setTimeout(() => {
                    loadNextCard(); // 加载新卡片，其相关的堆叠动画约 300-350ms
                    
                    // 在新卡片加载动画完成后再恢复按钮状态
                    setTimeout(() => {
                        dislikeBtn.setAttribute('aria-pressed', 'false'); // 恢复 aria-pressed 状态
                        dislikeBtn.disabled = false;  
                        likeBtn.disabled = false;
                    }, 350); // 这个延迟应大致等于 loadNextCard 中卡片堆叠动画的持续时间

                }, 500); // 用户要求的0.5秒延迟加载下一道菜
            }
        });
    }

    init();
});