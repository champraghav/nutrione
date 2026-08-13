import React, { useEffect, useState } from 'react';
import { api } from '@api/client';
import { Button } from '@components/Button';
import { Input } from '@components/Input';
import { Select } from '@components/Select';
import { calculateBMI } from '@utils/formatters';

interface Profile {
  email: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  sex: string | null;
  height_cm: string | number | null;
  weight_kg: string | number | null;
  activity_level: string | null;
}

const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'];

export function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [activityLevel, setActivityLevel] = useState('moderate');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getMe().then((res) => {
      if (res.success) {
        const p = res.data as Profile;
        setProfile(p);
        setFirstName(p.first_name ?? '');
        setLastName(p.last_name ?? '');
        setHeightCm(p.height_cm ? String(p.height_cm) : '');
        setWeightKg(p.weight_kg ? String(p.weight_kg) : '');
        setActivityLevel(p.activity_level ?? 'moderate');
      }
    });
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const res = await api.updateMe({
      firstName,
      lastName,
      heightCm: heightCm ? Number(heightCm) : undefined,
      weightKg: weightKg ? Number(weightKg) : undefined,
      activityLevel,
    });
    setSaving(false);
    if (res.success) {
      setProfile(res.data as Profile);
      setSaved(true);
    }
  };

  const bmi = heightCm && weightKg ? calculateBMI(Number(weightKg), Number(heightCm)) : null;

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
        <p className="text-gray-500 text-sm">{profile?.email}</p>
      </div>

      <form onSubmit={onSubmit} className="card space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <Input label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Height (cm)" type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
          <Input label="Weight (kg)" type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
        </div>
        <Select label="Activity level" value={activityLevel} onChange={(e) => setActivityLevel(e.target.value)}>
          {ACTIVITY_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level.replace('_', ' ')}
            </option>
          ))}
        </Select>

        {bmi && <p className="text-sm text-gray-500">Estimated BMI: {bmi}</p>}

        <div className="flex items-center gap-3">
          <Button type="submit" loading={saving}>
            Save changes
          </Button>
          {saved && <span className="text-success-600 text-sm">Saved</span>}
        </div>
      </form>
    </div>
  );
}
