document.addEventListener('DOMContentLoaded', () => {
    const likedRecipesListElement = document.getElementById('liked-recipes-list');
    const placeholderElement = likedRecipesListElement.querySelector('.placeholder');
    const LIKED_RECIPES_STORAGE_KEY = 'likedRecipes'; // 必须与 swipe.js 中的键名一致

    function getLikedRecipes() {
        const storedRecipes = localStorage.getItem(LIKED_RECIPES_STORAGE_KEY);
        return storedRecipes ? JSON.parse(storedRecipes) : {};
    }

    function removeLikedRecipe(recipeId) {
        const likedRecipes = getLikedRecipes();
        if (likedRecipes[recipeId]) {
            delete likedRecipes[recipeId];
            localStorage.setItem(LIKED_RECIPES_STORAGE_KEY, JSON.stringify(likedRecipes));
            console.log("Removed liked recipe:", recipeId);
            return true;
        }
        return false;
    }

    function createRecipeCardElement(recipe) {
        const card = document.createElement('div');
        card.classList.add('recipe-card');
        card.dataset.id = recipe.id;

        const defaultImageUrl = '/static/images/default_food.png'; // 保持一致
        const imageUrl = recipe.imageUrl || defaultImageUrl;

        let ratingHtml = '暂无评分';
        if (recipe.rating) {
            const numericRating = parseFloat(recipe.rating);
            if (!isNaN(numericRating)) {
                ratingHtml = '';
                for (let i = 1; i <= 5; i++) {
                    if (i <= numericRating) ratingHtml += '❤️';
                    else if (i - 0.5 <= numericRating) ratingHtml += '🧡';
                    else ratingHtml += '🤍';
                }
                ratingHtml += ` (${numericRating.toFixed(1)})`;
            }
        }

        card.innerHTML = `
            <img src="${imageUrl}" alt="${recipe.name || '美食图片'}" onerror="this.onerror=null;this.src='${defaultImageUrl}';">
            <div class="recipe-card-info">
                <h3>${recipe.name || '未知菜名'}</h3>
                <p>评分: ${ratingHtml}</p>
                <p>烹饪时间: ${recipe.cookingTime || '未知'}</p>
            </div>
            <div class="recipe-card-actions">
                <button class="btn-dislike-from-profile" data-id="${recipe.id}">不喜欢了</button>
            </div>
        `;

        const dislikeButton = card.querySelector('.btn-dislike-from-profile');
        dislikeButton.addEventListener('click', () => {
            if (confirm(`确定不再喜欢“${recipe.name || '该菜品'}”吗？`)) {
                if (removeLikedRecipe(recipe.id)) {
                    card.remove(); // 从DOM中移除卡片
                    // 检查是否还有其他喜欢的菜品，如果没有则显示占位符
                    if (likedRecipesListElement.children.length === 0) {
                         placeholderElement.textContent = '你还没有喜欢的菜品哦。';
                         likedRecipesListElement.appendChild(placeholderElement);
                    }
                }
            }
        });

        return card;
    }

    function loadLikedRecipes() {
        const likedRecipes = getLikedRecipes();
        const recipesArray = Object.values(likedRecipes); // 将对象转换为数组

        if (placeholderElement) placeholderElement.remove(); // 先移除占位符

        if (recipesArray.length > 0) {
            recipesArray.forEach(recipe => {
                const cardElement = createRecipeCardElement(recipe);
                likedRecipesListElement.appendChild(cardElement);
            });
        } else {
            if (placeholderElement) { // 确保占位符存在才操作
                placeholderElement.textContent = '你还没有喜欢的菜品哦。';
                likedRecipesListElement.appendChild(placeholderElement); // 如果没有喜欢的菜品，重新添加占位符
            }
        }
    }

    // 初始化页面
    loadLikedRecipes();
});