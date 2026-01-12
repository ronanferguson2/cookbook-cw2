// --- HELPER: DECODE AZURE COSMOS DATA ---
const decodeCosmosData = (data) => {
    if (Array.isArray(data) && data[0] && data[0]['$content']) {
        const base64Content = data[0]['$content'];
        const decodedString = atob(base64Content);
        return JSON.parse(decodedString);
    }
    return data;
};

// --- API FUNCTIONS ---
async function createRecipe(formData) {
    const response = await fetch(API.CREATE_URL, {
        method: 'POST',
        body: formData 
    });
    return await response.text();
}

async function getRecipeById(id) {
    const url = API.GET_BY_ID_URL.replace('%7Bid%7D', id);
    const response = await fetch(url);
    return await response.json();
}

async function updateRecipe(id, recipeObject) {
    const url = API.UPDATE_URL.replace('%7Bid%7D', id);
    const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recipeObject)
    });
    return await response.json();
}

// --- UI HANDLERS ---
let isEditMode = false;
let editingRecipeId = null;

const createForm = document.getElementById('createForm');

createForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (isEditMode) {
        // Handle update
        const recipeObject = {
            id: editingRecipeId,
            pk: createForm.pk.value,
            title: createForm.title.value,
            description: createForm.description.value,
            ingredients: JSON.parse(createForm.ingredients.value),
            steps: JSON.parse(createForm.steps.value),
            media: window.currentRecipeMedia,
            createdAt: window.currentRecipeCreatedAt
        };
        
        try {
            const res = await updateRecipe(editingRecipeId, recipeObject);
            document.getElementById('createResult').innerText = 'Recipe updated successfully!';
            setTimeout(() => {
                window.location.href = 'recipes.html';
            }, 1500);
        } catch (err) {
            console.error("Update failed:", err);
            document.getElementById('createResult').innerText = "Update failed. Check console.";
        }
    } else {
        // Handle create
        const formData = new FormData(createForm);
        
        const fileInput = createForm.querySelector('input[type="file"]');
        if(fileInput.files[0]) {
            formData.append('FileName', fileInput.files[0].name);
        }

        try {
            const res = await createRecipe(formData);
            document.getElementById('createResult').innerText = res;
            createForm.reset();
            setTimeout(() => {
                window.location.href = 'recipes.html';
            }, 1500);
        } catch (err) {
            console.error("Upload failed:", err);
            document.getElementById('createResult').innerText = "Upload failed. Check console.";
        }
    }
});

function resetForm() {
    isEditMode = false;
    editingRecipeId = null;
    window.currentRecipeMedia = null;
    window.currentRecipeCreatedAt = null;
    createForm.reset();
    const btn = createForm.querySelector('button');
    btn.innerText = '📤 Upload';
    document.getElementById('createResult').innerText = '';
    
    const cancelBtn = document.getElementById('cancelEdit');
    if (cancelBtn) cancelBtn.remove();
}

// Check for edit mode on page load
window.onload = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    
    if (editId) {
        const recipe = await getRecipeById(editId);
        if (recipe) {
            isEditMode = true;
            editingRecipeId = recipe.id;
            window.currentRecipeMedia = recipe.media;
            window.currentRecipeCreatedAt = recipe.createdAt;

            const ingredients = decodeCosmosData(recipe.ingredients || []);
            const steps = decodeCosmosData(recipe.steps || []);

            createForm.pk.value = recipe.pk || '';
            createForm.title.value = recipe.title || '';
            createForm.description.value = recipe.description || '';
            createForm.ingredients.value = JSON.stringify(ingredients);
            createForm.steps.value = JSON.stringify(steps);
            
            const btn = createForm.querySelector('button');
            btn.innerText = '💾 Save Changes';
            
            const cancelBtn = document.createElement('button');
            cancelBtn.id = 'cancelEdit';
            cancelBtn.type = 'button';
            cancelBtn.innerText = '✖️ Cancel';
            cancelBtn.style.marginLeft = '10px';
            cancelBtn.onclick = () => window.location.href = 'recipes.html';
            btn.parentNode.insertBefore(cancelBtn, btn.nextSibling);
            
            document.querySelector('h2').innerText = 'Edit Recipe';
        }
    }
};