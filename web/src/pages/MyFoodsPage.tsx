import React, { useEffect, useState } from 'react';
import { api } from '@api/client';
import { Button } from '@components/Button';
import { Input } from '@components/Input';
import { Badge } from '@components/Badge';

interface OwnFood {
  id: string;
  name: string;
  brand: string | null;
  region: string;
  serving_size: string;
  serving_unit: string;
  calories: string;
  protein_g: string;
  recipe_servings: string | null;
  ingredient_count: number;
}

interface Ingredient {
  id: string;
  food_id: string;
  food_name: string;
  quantity: string;
  unit: string;
}

interface SearchFood {
  id: string;
  name: string;
  serving_size: number;
  serving_unit: string;
  calories: number;
}

const n = (v: string | number | null) => Number(v ?? 0);

export function MyFoodsPage() {
  const [foods, setFoods] = useState<OwnFood[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'none' | 'food' | 'recipe'>('none');

  // Custom food form
  const [name, setName] = useState('');
  const [servingSize, setServingSize] = useState('100');
  const [servingUnit, setServingUnit] = useState('g');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  // Recipe
  const [recipeName, setRecipeName] = useState('');
  const [servings, setServings] = useState('4');
  const [openRecipe, setOpenRecipe] = useState<{ recipe: OwnFood; ingredients: Ingredient[] } | null>(null);
  const [ingSearch, setIngSearch] = useState('');
  const [ingResults, setIngResults] = useState<SearchFood[]>([]);
  const [ingPicked, setIngPicked] = useState<SearchFood | null>(null);
  const [ingQty, setIngQty] = useState('');

  const load = async () => {
    const res = await api.getMyFoods();
    if (res.success) setFoods(res.data as OwnFood[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (ingSearch.trim().length < 2) {
      setIngResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await api.searchFoods(ingSearch, 8);
      if (res.success) setIngResults(res.data as SearchFood[]);
    }, 250);
    return () => clearTimeout(t);
  }, [ingSearch]);

  const saveFood = async () => {
    setError('');
    const res = await api.createCustomFood({
      name: name.trim(),
      servingSize: Number(servingSize) || 100,
      servingUnit,
      calories: Number(calories) || 0,
      proteinG: Number(protein) || 0,
      carbsG: Number(carbs) || 0,
      fatG: Number(fat) || 0,
    });
    if (res.success) {
      setName('');
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
      setMode('none');
      load();
    } else {
      setError(res.error?.message ?? 'Could not save that food.');
    }
  };

  const startRecipe = async () => {
    setError('');
    const res = await api.createRecipe(recipeName.trim(), Number(servings) || 4);
    if (res.success) {
      setRecipeName('');
      setMode('none');
      await load();
      openRecipeEditor((res.data as OwnFood).id);
    } else {
      setError(res.error?.message ?? 'Could not create that recipe.');
    }
  };

  const openRecipeEditor = async (id: string) => {
    const res = await api.getRecipe(id);
    if (res.success) setOpenRecipe(res.data as { recipe: OwnFood; ingredients: Ingredient[] });
  };

  const addIngredient = async () => {
    if (!openRecipe || !ingPicked) return;
    const res = await api.addRecipeIngredient(
      openRecipe.recipe.id,
      ingPicked.id,
      Number(ingQty) || Number(ingPicked.serving_size),
      ingPicked.serving_unit
    );
    if (res.success) {
      setOpenRecipe(res.data as { recipe: OwnFood; ingredients: Ingredient[] });
      setIngPicked(null);
      setIngSearch('');
      setIngQty('');
      load();
    } else {
      setError(res.error?.message ?? 'Could not add that ingredient.');
    }
  };

  const removeIngredient = async (ingredientId: string) => {
    if (!openRecipe) return;
    const res = await api.removeRecipeIngredient(openRecipe.recipe.id, ingredientId);
    if (res.success) {
      setOpenRecipe(res.data as { recipe: OwnFood; ingredients: Ingredient[] });
      load();
    }
  };

  const changeServings = async (value: number) => {
    if (!openRecipe) return;
    const res = await api.setRecipeServings(openRecipe.recipe.id, value);
    if (res.success) {
      setOpenRecipe(res.data as { recipe: OwnFood; ingredients: Ingredient[] });
      load();
    }
  };

  const remove = async (food: OwnFood) => {
    if (!window.confirm(`Delete "${food.name}"?`)) return;
    const res = await api.deleteMyFood(food.id);
    if (res.success) {
      if (openRecipe?.recipe.id === food.id) setOpenRecipe(null);
      load();
    } else {
      setError(res.error?.message ?? 'Could not delete that food.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My foods</h1>
          <p className="text-gray-500 text-sm">
            Anything not in the database — a packet from your shop, or your own recipe.
          </p>
        </div>
        {mode === 'none' && (
          <div className="flex gap-2">
            <Button onClick={() => setMode('food')}>+ Food</Button>
            <Button variant="secondary" onClick={() => setMode('recipe')}>
              + Recipe
            </Button>
          </div>
        )}
      </div>

      {mode === 'food' && (
        <div className="card space-y-3">
          <h2 className="font-semibold text-gray-900">New food</h2>
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Amma's chutney podi" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Serving size" type="number" value={servingSize} onChange={(e) => setServingSize(e.target.value)} />
            <Input label="Unit" value={servingUnit} onChange={(e) => setServingUnit(e.target.value)} />
          </div>
          <p className="text-xs text-gray-400">Per that serving:</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Input label="Calories" type="number" value={calories} onChange={(e) => setCalories(e.target.value)} />
            <Input label="Protein (g)" type="number" value={protein} onChange={(e) => setProtein(e.target.value)} />
            <Input label="Carbs (g)" type="number" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
            <Input label="Fat (g)" type="number" value={fat} onChange={(e) => setFat(e.target.value)} />
          </div>
          {error && <p className="text-sm text-danger-600">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={saveFood} disabled={!name.trim()}>
              Save food
            </Button>
            <Button variant="secondary" onClick={() => setMode('none')}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {mode === 'recipe' && (
        <div className="card space-y-3">
          <h2 className="font-semibold text-gray-900">New recipe</h2>
          <p className="text-sm text-gray-500">
            Add ingredients and the per-serving nutrition is worked out for you.
          </p>
          <Input label="Name" value={recipeName} onChange={(e) => setRecipeName(e.target.value)} placeholder="Rajma chawal" />
          <Input label="How many servings does it make" type="number" min="1" value={servings} onChange={(e) => setServings(e.target.value)} />
          {error && <p className="text-sm text-danger-600">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={startRecipe} disabled={!recipeName.trim()}>
              Create and add ingredients
            </Button>
            <Button variant="secondary" onClick={() => setMode('none')}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {openRecipe && (
        <div className="card space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-900">{openRecipe.recipe.name}</h2>
              <p className="text-sm text-gray-500">
                {n(openRecipe.recipe.calories).toFixed(0)} kcal · {n(openRecipe.recipe.protein_g).toFixed(1)} g protein
                <span className="text-gray-400"> per serving</span>
              </p>
            </div>
            <button className="text-sm text-gray-400 hover:text-gray-600" onClick={() => setOpenRecipe(null)}>
              Close
            </button>
          </div>

          <div className="w-40">
            <Input
              label="Servings"
              type="number"
              min="1"
              value={String(n(openRecipe.recipe.recipe_servings) || 1)}
              onChange={(e) => changeServings(Number(e.target.value) || 1)}
            />
          </div>

          {openRecipe.ingredients.length === 0 ? (
            <p className="text-sm text-gray-500">No ingredients yet.</p>
          ) : (
            <ul className="space-y-1">
              {openRecipe.ingredients.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-800">
                    {i.food_name} <span className="text-gray-400">· {n(i.quantity)} {i.unit}</span>
                  </span>
                  <button
                    className="text-gray-400 hover:text-danger-600 px-1"
                    onClick={() => removeIngredient(i.id)}
                    aria-label={`Remove ${i.food_name}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="relative">
            <Input
              label="Add an ingredient"
              value={ingSearch}
              onChange={(e) => {
                setIngSearch(e.target.value);
                setIngPicked(null);
              }}
              placeholder="Search foods…"
            />
            {ingResults.length > 0 && (
              <ul className="absolute z-10 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-56 overflow-y-auto">
                {ingResults.map((f) => (
                  <li key={f.id}>
                    <button
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                      onClick={() => {
                        setIngPicked(f);
                        setIngSearch(f.name);
                        setIngResults([]);
                        setIngQty(String(Number(f.serving_size)));
                      }}
                    >
                      {f.name}
                      <span className="text-gray-400">
                        {' '}· {Number(f.calories)} kcal / {Number(f.serving_size)} {f.serving_unit}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {ingPicked && (
            <div className="flex items-end gap-2">
              <div className="w-32">
                <Input label={`Amount (${ingPicked.serving_unit})`} type="number" value={ingQty} onChange={(e) => setIngQty(e.target.value)} />
              </div>
              <Button onClick={addIngredient}>Add</Button>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : foods.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-4xl mb-2">🥘</p>
          <p className="font-medium text-gray-800">Nothing of your own yet</p>
          <p className="text-sm text-gray-500">
            Add a food or build a recipe — both become searchable everywhere in the app.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {foods.map((f) => (
            <div key={f.id} className="card flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-gray-900 truncate">{f.name}</p>
                  <Badge variant={f.region === 'recipe' ? 'primary' : 'gray'}>{f.region}</Badge>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {n(f.calories).toFixed(0)} kcal · {n(f.protein_g).toFixed(1)} g protein per {n(f.serving_size)}{' '}
                  {f.serving_unit}
                  {f.region === 'recipe' && ` · ${f.ingredient_count} ingredient${f.ingredient_count === 1 ? '' : 's'}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {f.region === 'recipe' && (
                  <button className="btn-secondary text-xs" onClick={() => openRecipeEditor(f.id)}>
                    Edit
                  </button>
                )}
                <button className="text-gray-400 hover:text-danger-600 px-1" onClick={() => remove(f)} aria-label={`Delete ${f.name}`}>
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && !openRecipe && mode === 'none' && <p className="text-sm text-danger-600">{error}</p>}
    </div>
  );
}
