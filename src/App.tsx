import { useEffect, useMemo, useState } from 'react';

type Profile = {
  id: string;
  name: string;
  age: number;
  height: number;
  bodyweight: number;
  bestBench: number;
  setWeight: number;
  reps: number;
  rpe: number;
  goal: number;
  benchDays: number;
  grip: string;
  stickingPoint: string;
};

const STORAGE_KEY = 'bench-ai-profiles';
const ACTIVE_PROFILE_KEY = 'bench-ai-active-profile';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundTo(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function estimate1RM(weight: number, reps: number, rpe: number) {
  if (!weight || !reps) return 0;
  const rir = Math.max(0, 10 - rpe);
  const effectiveReps = reps + rir;
  const epley = weight * (1 + effectiveReps / 30);
  const brzycki = (weight * 36) / Math.max(1, 37 - effectiveReps);
  return (epley + brzycki) / 2;
}

function getLevel(ratio: number) {
  if (ratio >= 2) return 'Elite';
  if (ratio >= 1.75) return 'Advanced';
  if (ratio >= 1.4) return 'Intermediate';
  return 'Novice';
}

function createBlankProfile(): Profile {
  return {
    id: crypto.randomUUID(),
    name: 'New Person',
    age: 20,
    height: 182,
    bodyweight: 93,
    bestBench: 160,
    setWeight: 140,
    reps: 5,
    rpe: 8,
    goal: 170,
    benchDays: 3,
    grip: 'wide',
    stickingPoint: 'lockout',
  };
}

export default function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>('');

  useEffect(() => {
    const savedProfiles = localStorage.getItem(STORAGE_KEY);
    const savedActiveProfile = localStorage.getItem(ACTIVE_PROFILE_KEY);

    if (savedProfiles) {
      const parsed = JSON.parse(savedProfiles) as Profile[];
      setProfiles(parsed);

      if (savedActiveProfile && parsed.some((p) => p.id === savedActiveProfile)) {
        setActiveProfileId(savedActiveProfile);
      } else if (parsed.length > 0) {
        setActiveProfileId(parsed[0].id);
      }
    } else {
      const starter = createBlankProfile();
      setProfiles([starter]);
      setActiveProfileId(starter.id);
    }
  }, []);

  useEffect(() => {
    if (profiles.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    }
  }, [profiles]);

  useEffect(() => {
    if (activeProfileId) {
      localStorage.setItem(ACTIVE_PROFILE_KEY, activeProfileId);
    }
  }, [activeProfileId]);

  const activeProfile =
    profiles.find((p) => p.id === activeProfileId) ?? profiles[0] ?? null;

  function updateProfile<K extends keyof Profile>(key: K, value: Profile[K]) {
    if (!activeProfile) return;
    setProfiles((prev) =>
      prev.map((p) => (p.id === activeProfile.id ? { ...p, [key]: value } : p))
    );
  }

  function saveNewProfile() {
    const newProfile = createBlankProfile();
    setProfiles((prev) => [...prev, newProfile]);
    setActiveProfileId(newProfile.id);
  }

  function duplicateProfile() {
    if (!activeProfile) return;
    const copied: Profile = {
      ...activeProfile,
      id: crypto.randomUUID(),
      name: `${activeProfile.name} Copy`,
    };
    setProfiles((prev) => [...prev, copied]);
    setActiveProfileId(copied.id);
  }

  function deleteProfile() {
    if (!activeProfile) return;
    if (profiles.length === 1) {
      const fresh = createBlankProfile();
      setProfiles([fresh]);
      setActiveProfileId(fresh.id);
      return;
    }

    const nextProfiles = profiles.filter((p) => p.id !== activeProfile.id);
    setProfiles(nextProfiles);
    setActiveProfileId(nextProfiles[0].id);
  }

  const analysis = useMemo(() => {
    if (!activeProfile) return null;

    const e1rm = estimate1RM(
      activeProfile.setWeight,
      activeProfile.reps,
      activeProfile.rpe
    );
    const chosenMax = roundTo(Math.max(activeProfile.bestBench, e1rm), 1);
    const ratio = activeProfile.bodyweight
      ? roundTo(chosenMax / activeProfile.bodyweight, 2)
      : 0;
    const level = getLevel(ratio);
    const goalGap = roundTo(activeProfile.goal - chosenMax, 1);
    const realism = clamp(roundTo(92 - Math.max(0, goalGap) * 5.5, 0), 15, 99);

    let mainFeedback = '';
    if (activeProfile.stickingPoint === 'lockout') {
      mainFeedback =
        'This person looks limited at lockout. Prioritise close-grip bench, triceps work, and overload partials.';
    } else if (activeProfile.stickingPoint === 'off_chest') {
      mainFeedback =
        'This person looks limited off the chest. Prioritise paused bench, Spoto press, and staying tighter on the touch.';
    } else {
      mainFeedback =
        'This person looks limited in mid-range. Prioritise bar path consistency, upper-back stability, and leg drive timing.';
    }

    const gripFeedback =
      activeProfile.grip === 'wide'
        ? 'Keep wide grip for heavy specificity, but use a slightly closer grip on secondary work.'
        : 'Use competition grip on heavy work so strength carries over to max attempts.';

    const program = [
      {
        week: 'Week 1',
        lines: [
          'Day 1: Heavy single @ 88–90%, then 4x3 @ 80–83%',
          'Day 2: 5x5 @ 72–76%',
          'Day 3: 8x3 speed bench @ 60–65%',
        ],
      },
      {
        week: 'Week 2',
        lines: [
          'Day 1: 3 singles @ 91–94%, then 3x2 @ 84–86%',
          'Day 2: 4x4 @ 74–78%',
          'Day 3: 6x3 speed bench + paused triples',
        ],
      },
      {
        week: 'Week 3',
        lines: [
          'Day 1: 90%, 94%, 97–100% if fast',
          'Day 2: 3x3 @ 58–62%',
          'Day 3: Test day / max attempt',
        ],
      },
    ];

    return {
      e1rm,
      chosenMax,
      ratio,
      level,
      goalGap,
      realism,
      mainFeedback,
      gripFeedback,
      program,
    };
  }, [activeProfile]);

  if (!activeProfile || !analysis) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        color: '#0f172a',
        fontFamily: 'Arial, sans-serif',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 1150, margin: '0 auto' }}>
        <h1 style={{ fontSize: 40, marginBottom: 8 }}>Bench AI Coach</h1>
        <p style={{ color: '#475569', marginBottom: 24 }}>
          Save profiles and switch between different people.
        </p>

        <div
          style={{
            background: '#fff',
            borderRadius: 20,
            padding: 20,
            boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
            marginBottom: 24,
          }}
        >
          <h2 style={{ marginTop: 0 }}>Profiles</h2>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <select
              value={activeProfileId}
              onChange={(e) => setActiveProfileId(e.target.value)}
              style={selectStyle}
            >
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>

            <button onClick={saveNewProfile} style={buttonStyle}>
              New Profile
            </button>
            <button onClick={duplicateProfile} style={buttonStyle}>
              Duplicate
            </button>
            <button onClick={deleteProfile} style={deleteButtonStyle}>
              Delete
            </button>
          </div>

          <div style={{ color: '#475569', fontSize: 14 }}>
            Profiles are saved automatically in your browser.
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.2fr',
            gap: 24,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 20,
              padding: 20,
              boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
            }}
          >
            <h2 style={{ marginTop: 0 }}>Person</h2>

            <TextInput label="Name" value={activeProfile.name} onChange={(v) => updateProfile('name', v)} />
            <NumberInput label="Age" value={activeProfile.age} onChange={(v) => updateProfile('age', v)} />
            <NumberInput label="Height (cm)" value={activeProfile.height} onChange={(v) => updateProfile('height', v)} />
            <NumberInput label="Bodyweight (kg)" value={activeProfile.bodyweight} onChange={(v) => updateProfile('bodyweight', v)} />

            <h2>Bench Data</h2>

            <NumberInput label="Best Bench (kg)" value={activeProfile.bestBench} onChange={(v) => updateProfile('bestBench', v)} />
            <NumberInput label="Recent Set Weight (kg)" value={activeProfile.setWeight} onChange={(v) => updateProfile('setWeight', v)} />
            <NumberInput label="Recent Set Reps" value={activeProfile.reps} onChange={(v) => updateProfile('reps', v)} />
            <NumberInput label="Recent Set RPE" value={activeProfile.rpe} onChange={(v) => updateProfile('rpe', v)} />
            <NumberInput label="Goal Bench (kg)" value={activeProfile.goal} onChange={(v) => updateProfile('goal', v)} />
            <NumberInput label="Bench Days / Week" value={activeProfile.benchDays} onChange={(v) => updateProfile('benchDays', v)} />

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: 8 }}>Grip</label>
              <select
                value={activeProfile.grip}
                onChange={(e) => updateProfile('grip', e.target.value)}
                style={selectStyle}
              >
                <option value="wide">Wide</option>
                <option value="medium">Medium</option>
                <option value="close">Close</option>
              </select>
            </div>

            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', fontWeight: 700, marginBottom: 8 }}>
                Sticking Point
              </label>
              <select
                value={activeProfile.stickingPoint}
                onChange={(e) => updateProfile('stickingPoint', e.target.value)}
                style={selectStyle}
              >
                <option value="off_chest">Off chest</option>
                <option value="mid_range">Mid-range</option>
                <option value="lockout">Lockout</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 20 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 16,
              }}
            >
              <StatCard title="Modelled 1RM" value={`${analysis.chosenMax} kg`} />
              <StatCard title="Strength Level" value={analysis.level} />
              <StatCard title="BW Ratio" value={`${analysis.ratio}x`} />
              <StatCard title="Goal Gap" value={`${analysis.goalGap} kg`} />
            </div>

            <div
              style={{
                background: '#fff',
                borderRadius: 20,
                padding: 20,
                boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
              }}
            >
              <h2 style={{ marginTop: 0 }}>Profile Summary</h2>
              <p><strong>Name:</strong> {activeProfile.name}</p>
              <p><strong>Age:</strong> {activeProfile.age}</p>
              <p><strong>Height:</strong> {activeProfile.height} cm</p>
              <p><strong>Bodyweight:</strong> {activeProfile.bodyweight} kg</p>
            </div>

            <div
              style={{
                background: '#fff',
                borderRadius: 20,
                padding: 20,
                boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
              }}
            >
              <h2 style={{ marginTop: 0 }}>Feedback</h2>
              <p>
                Estimated max from recent set: <strong>{roundTo(analysis.e1rm)} kg</strong>
              </p>
              <p>
                {activeProfile.name}'s current working max is about <strong>{analysis.chosenMax} kg</strong>.
              </p>
              <p>
                Strength level: <strong>{analysis.level}</strong>
              </p>
              <p>
                Goal realism score: <strong>{analysis.realism}%</strong>
              </p>
              <p>{analysis.gripFeedback}</p>
              <p>{analysis.mainFeedback}</p>
            </div>

            <div
              style={{
                background: '#fff',
                borderRadius: 20,
                padding: 20,
                boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
              }}
            >
              <h2 style={{ marginTop: 0 }}>3-Week Peak</h2>
              {analysis.program.map((week) => (
                <div key={week.week} style={{ marginBottom: 18 }}>
                  <h3 style={{ marginBottom: 8 }}>{week.week}</h3>
                  {week.lines.map((line) => (
                    <div key={line} style={{ color: '#334155', marginBottom: 6 }}>
                      • {line}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontWeight: 700, marginBottom: 8 }}>{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          padding: 12,
          borderRadius: 12,
          border: '1px solid #cbd5e1',
          fontSize: 16,
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontWeight: 700, marginBottom: 8 }}>{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: 12,
          borderRadius: 12,
          border: '1px solid #cbd5e1',
          fontSize: 16,
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 18,
        padding: 18,
        boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
      }}
    >
      <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  minWidth: 220,
  padding: 12,
  borderRadius: 12,
  border: '1px solid #cbd5e1',
  fontSize: 16,
  boxSizing: 'border-box',
};

const buttonStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 12,
  border: 'none',
  background: '#0f172a',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
};

const deleteButtonStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 12,
  border: 'none',
  background: '#b91c1c',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
};