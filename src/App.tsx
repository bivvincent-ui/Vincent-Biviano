import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import type { Session } from '@supabase/supabase-js';

type Profile = {
  id: string;
  user_id: string;
  name: string | null;
  age: number | null;
  height: number | null;
  bodyweight: number | null;
  best_bench: number | null;
  set_weight: number | null;
  reps: number | null;
  rpe: number | null;
  goal: number | null;
  bench_days: number | null;
  grip: string | null;
  sticking_point: string | null;
  created_at: string;
};

type ProfileInput = Omit<Profile, 'id' | 'user_id' | 'created_at'>;

const defaultProfile: ProfileInput = {
  name: 'New Profile',
  age: 18,
  height: 180,
  bodyweight: 80,
  best_bench: 100,
  set_weight: 80,
  reps: 5,
  rpe: 8,
  goal: 110,
  bench_days: 2,
  grip: 'Medium',
  sticking_point: 'Off Chest',
};

function round(num: number, places = 1) {
  return Number(num.toFixed(places));
}

function calculateEpley(weight: number, reps: number) {
  return weight * (1 + reps / 30);
}

function calculateBrzycki(weight: number, reps: number) {
  if (reps >= 37) return weight;
  return weight * (36 / (37 - reps));
}

function estimate1RM(weight: number, reps: number) {
  if (!weight || !reps) return 0;
  const epley = calculateEpley(weight, reps);
  const brzycki = calculateBrzycki(weight, reps);
  return round((epley + brzycki) / 2, 1);
}

function getStrengthLevel(oneRM: number, bodyweight: number) {
  if (!oneRM || !bodyweight) return 'N/A';
  const ratio = oneRM / bodyweight;

  if (ratio < 0.8) return 'Novice';
  if (ratio < 1.05) return 'Intermediate';
  if (ratio < 1.35) return 'Advanced';
  if (ratio < 1.7) return 'Elite';
  return 'World Class';
}

function getWeakPoint(stickingPoint: string | null) {
  switch (stickingPoint) {
    case 'Off Chest':
      return 'Likely pec / pause strength weakness. Add paused bench and Spoto press.';
    case 'Mid Range':
      return 'Likely overall pressing strength issue. Add close grip bench and pin press.';
    case 'Lockout':
      return 'Likely triceps weakness. Add board press, dips, and JM press.';
    default:
      return 'Choose a sticking point for tailored advice.';
  }
}

function getProgram(oneRM: number) {
  if (!oneRM) return [];

  return [
    {
      week: 'Week 1',
      day1: `${round(oneRM * 0.75)}kg x 5 x 5`,
      day2: `${round(oneRM * 0.8)}kg x 4 x 4`,
    },
    {
      week: 'Week 2',
      day1: `${round(oneRM * 0.825)}kg x 4 x 3`,
      day2: `${round(oneRM * 0.875)}kg x 3 x 2`,
    },
    {
      week: 'Week 3',
      day1: `${round(oneRM * 0.9)}kg x 2 x 2`,
      day2: `${round(oneRM * 0.95)}kg x 1 x 1`,
    },
  ];
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      console.log('GET SESSION:', session);
      console.log('GET SESSION ERROR:', error);

      setSession(session);
      setLoading(false);
    };

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('AUTH EVENT:', event);
      console.log('AUTH SESSION:', session);
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setProfiles([]);
      setSelectedProfileId(null);
      return;
    }

    fetchProfiles();
  }, [session]);

  const fetchProfiles = async () => {
    if (!session?.user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading profiles:', error);
      return;
    }

    const loadedProfiles = (data ?? []) as Profile[];
    setProfiles(loadedProfiles);

    if (loadedProfiles.length > 0) {
      setSelectedProfileId((current) =>
        current && loadedProfiles.some((p) => p.id === current)
          ? current
          : loadedProfiles[0].id
      );
    } else {
      const newId = await createProfile();
      if (newId) setSelectedProfileId(newId);
    }
  };

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId]
  );

  const oneRM = useMemo(() => {
    if (!selectedProfile) return 0;
    const weight = Number(selectedProfile.set_weight ?? 0);
    const reps = Number(selectedProfile.reps ?? 0);
    return estimate1RM(weight, reps);
  }, [selectedProfile]);

  const strengthLevel = useMemo(() => {
    if (!selectedProfile) return 'N/A';
    return getStrengthLevel(oneRM, Number(selectedProfile.bodyweight ?? 0));
  }, [selectedProfile, oneRM]);

  const bodyweightRatio = useMemo(() => {
    if (!selectedProfile?.bodyweight || !oneRM) return 0;
    return round(oneRM / Number(selectedProfile.bodyweight), 2);
  }, [selectedProfile, oneRM]);

  const goalPercent = useMemo(() => {
    if (!selectedProfile?.goal || !oneRM) return 0;
    return round((oneRM / Number(selectedProfile.goal)) * 100, 1);
  }, [selectedProfile, oneRM]);

  const program = useMemo(() => getProgram(oneRM), [oneRM]);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    });

    if (error) {
      console.error('Google login error:', error.message);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const createProfile = async () => {
    if (!session?.user) return null;

    const payload = {
      user_id: session.user.id,
      ...defaultProfile,
      name: `Profile ${profiles.length + 1}`,
    };

    const { data, error } = await supabase
      .from('profiles')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Error creating profile:', error);
      return null;
    }

    const newProfile = data as Profile;
    setProfiles((prev) => [...prev, newProfile]);
    setSelectedProfileId(newProfile.id);
    return newProfile.id;
  };

  const duplicateProfile = async () => {
    if (!session?.user || !selectedProfile) return;

    const payload = {
      user_id: session.user.id,
      name: `${selectedProfile.name ?? 'Profile'} Copy`,
      age: selectedProfile.age,
      height: selectedProfile.height,
      bodyweight: selectedProfile.bodyweight,
      best_bench: selectedProfile.best_bench,
      set_weight: selectedProfile.set_weight,
      reps: selectedProfile.reps,
      rpe: selectedProfile.rpe,
      goal: selectedProfile.goal,
      bench_days: selectedProfile.bench_days,
      grip: selectedProfile.grip,
      sticking_point: selectedProfile.sticking_point,
    };

    const { data, error } = await supabase
      .from('profiles')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Error duplicating profile:', error);
      return;
    }

    const newProfile = data as Profile;
    setProfiles((prev) => [...prev, newProfile]);
    setSelectedProfileId(newProfile.id);
  };

  const deleteProfile = async () => {
    if (!selectedProfile) return;

    const confirmDelete = window.confirm(
      `Delete "${selectedProfile.name ?? 'this profile'}"?`
    );
    if (!confirmDelete) return;

    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', selectedProfile.id);

    if (error) {
      console.error('Error deleting profile:', error);
      return;
    }

    const updated = profiles.filter((p) => p.id !== selectedProfile.id);
    setProfiles(updated);
    setSelectedProfileId(updated[0]?.id ?? null);

    if (updated.length === 0) {
      const newId = await createProfile();
      if (newId) setSelectedProfileId(newId);
    }
  };

  const updateLocalProfile = <K extends keyof Profile>(
    key: K,
    value: Profile[K]
  ) => {
    if (!selectedProfile) return;

    setProfiles((prev) =>
      prev.map((p) =>
        p.id === selectedProfile.id
          ? {
              ...p,
              [key]: value,
            }
          : p
      )
    );
  };

  useEffect(() => {
    if (!selectedProfile?.id) return;

    const timeout = setTimeout(async () => {
      setSaving(true);

      const { error } = await supabase
        .from('profiles')
        .update({
          name: selectedProfile.name,
          age: selectedProfile.age,
          height: selectedProfile.height,
          bodyweight: selectedProfile.bodyweight,
          best_bench: selectedProfile.best_bench,
          set_weight: selectedProfile.set_weight,
          reps: selectedProfile.reps,
          rpe: selectedProfile.rpe,
          goal: selectedProfile.goal,
          bench_days: selectedProfile.bench_days,
          grip: selectedProfile.grip,
          sticking_point: selectedProfile.sticking_point,
        })
        .eq('id', selectedProfile.id);

      if (error) {
        console.error('Error saving profile:', error);
      }

      setSaving(false);
    }, 700);

    return () => clearTimeout(timeout);
  }, [
    selectedProfile?.id,
    selectedProfile?.name,
    selectedProfile?.age,
    selectedProfile?.height,
    selectedProfile?.bodyweight,
    selectedProfile?.best_bench,
    selectedProfile?.set_weight,
    selectedProfile?.reps,
    selectedProfile?.rpe,
    selectedProfile?.goal,
    selectedProfile?.bench_days,
    selectedProfile?.grip,
    selectedProfile?.sticking_point,
  ]);

  if (loading) {
    return (
      <div style={styles.centerWrap}>
        <div style={styles.card}>
          <h1 style={styles.title}>Strength Systems</h1>
          <p style={styles.subtitle}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={styles.centerWrap}>
        <div style={{ ...styles.card, maxWidth: 460, textAlign: 'center' }}>
          <div style={styles.logo}>🏋️</div>
          <h1 style={styles.title}>Strength Systems</h1>
          <p style={styles.subtitle}>Bench AI Coach</p>

          <div style={styles.heroBox}>
            <p style={styles.heroText}>
              Track your bench, analyse your strength, and build better pressing
              performance.
            </p>
          </div>

          <button style={styles.googleButton} onClick={signInWithGoogle}>
            Continue with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.headerTitle}>Strength Systems</h1>
          <p style={styles.headerSubtitle}>Bench AI Coach</p>
        </div>

        <div style={styles.headerRight}>
          <span style={styles.userText}>{session.user.email}</span>
          <button style={styles.secondaryButton} onClick={signOut}>
            Sign Out
          </button>
        </div>
      </header>

      <div style={styles.layout}>
        <aside style={styles.sidebar}>
          <div style={styles.sidebarTop}>
            <h2 style={styles.sectionTitle}>Profiles</h2>
            <button style={styles.primaryButton} onClick={createProfile}>
              + New
            </button>
          </div>

          <div style={styles.profileList}>
            {profiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => setSelectedProfileId(profile.id)}
                style={{
                  ...styles.profileButton,
                  ...(selectedProfileId === profile.id
                    ? styles.profileButtonActive
                    : {}),
                }}
              >
                <div style={styles.profileName}>{profile.name || 'Unnamed'}</div>
                <div style={styles.profileMeta}>
                  BW {profile.bodyweight ?? '-'}kg · Bench {profile.best_bench ?? '-'}kg
                </div>
              </button>
            ))}
          </div>

          <div style={styles.sidebarActions}>
            <button style={styles.secondaryButtonFull} onClick={duplicateProfile}>
              Duplicate
            </button>
            <button style={styles.deleteButton} onClick={deleteProfile}>
              Delete
            </button>
          </div>
        </aside>

        <main style={styles.main}>
          {selectedProfile && (
            <>
              <section style={styles.cardSection}>
                <div style={styles.sectionHeader}>
                  <h2 style={styles.sectionTitle}>Profile Details</h2>
                  <span style={styles.saveText}>{saving ? 'Saving...' : 'Saved'}</span>
                </div>

                <div style={styles.grid}>
                  <InputField
                    label="Name"
                    value={selectedProfile.name ?? ''}
                    onChange={(value) => updateLocalProfile('name', value)}
                  />
                  <NumberField
                    label="Age"
                    value={selectedProfile.age}
                    onChange={(value) => updateLocalProfile('age', value)}
                  />
                  <NumberField
                    label="Height (cm)"
                    value={selectedProfile.height}
                    onChange={(value) => updateLocalProfile('height', value)}
                  />
                  <NumberField
                    label="Bodyweight (kg)"
                    value={selectedProfile.bodyweight}
                    onChange={(value) => updateLocalProfile('bodyweight', value)}
                  />
                  <NumberField
                    label="Best Bench (kg)"
                    value={selectedProfile.best_bench}
                    onChange={(value) => updateLocalProfile('best_bench', value)}
                  />
                  <NumberField
                    label="Working Weight (kg)"
                    value={selectedProfile.set_weight}
                    onChange={(value) => updateLocalProfile('set_weight', value)}
                  />
                  <NumberField
                    label="Reps"
                    value={selectedProfile.reps}
                    onChange={(value) => updateLocalProfile('reps', value)}
                  />
                  <NumberField
                    label="RPE"
                    value={selectedProfile.rpe}
                    step="0.5"
                    onChange={(value) => updateLocalProfile('rpe', value)}
                  />
                  <NumberField
                    label="Goal Bench (kg)"
                    value={selectedProfile.goal}
                    onChange={(value) => updateLocalProfile('goal', value)}
                  />
                  <NumberField
                    label="Bench Days / Week"
                    value={selectedProfile.bench_days}
                    onChange={(value) => updateLocalProfile('bench_days', value)}
                  />
                  <SelectField
                    label="Grip"
                    value={selectedProfile.grip ?? 'Medium'}
                    options={['Close', 'Medium', 'Wide']}
                    onChange={(value) => updateLocalProfile('grip', value)}
                  />
                  <SelectField
                    label="Sticking Point"
                    value={selectedProfile.sticking_point ?? 'Off Chest'}
                    options={['Off Chest', 'Mid Range', 'Lockout']}
                    onChange={(value) => updateLocalProfile('sticking_point', value)}
                  />
                </div>
              </section>

              <section style={styles.statsGrid}>
                <StatCard title="Estimated 1RM" value={`${oneRM} kg`} />
                <StatCard title="Strength Level" value={strengthLevel} />
                <StatCard title="BW Ratio" value={`${bodyweightRatio}x`} />
                <StatCard title="Goal Progress" value={`${goalPercent}%`} />
              </section>

              <section style={styles.cardSection}>
                <h2 style={styles.sectionTitle}>Bench Analysis</h2>
                <div style={styles.analysisBox}>
                  <p>
                    <strong>Weak Point Insight:</strong>{' '}
                    {getWeakPoint(selectedProfile.sticking_point)}
                  </p>
                  <p>
                    <strong>Grip Style:</strong> {selectedProfile.grip ?? 'N/A'}
                  </p>
                  <p>
                    <strong>Training Recommendation:</strong>{' '}
                    {Number(selectedProfile.rpe ?? 0) >= 9
                      ? 'Your RPE is high. Reduce fatigue slightly and focus on cleaner top sets.'
                      : 'Your RPE is manageable. Keep building volume and progress load steadily.'}
                  </p>
                </div>
              </section>

              <section style={styles.cardSection}>
                <h2 style={styles.sectionTitle}>3-Week Peaking Program</h2>
                <div style={styles.programGrid}>
                  {program.map((week) => (
                    <div key={week.week} style={styles.programCard}>
                      <h3 style={styles.programTitle}>{week.week}</h3>
                      <p><strong>Day 1:</strong> {week.day1}</p>
                      <p><strong>Day 2:</strong> {week.day2}</p>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statTitle}>{title}</div>
      <div style={styles.statValue}>{value}</div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <input
        style={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = '1',
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  step?: string;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <input
        style={styles.input}
        type="number"
        step={step}
        value={value ?? ''}
        onChange={(e) =>
          onChange(e.target.value === '' ? null : Number(e.target.value))
        }
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>{label}</span>
      <select
        style={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    minHeight: '100vh',
    background:
      'linear-gradient(135deg, #0f172a 0%, #111827 40%, #1e293b 100%)',
    color: 'white',
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    padding: '24px',
  },
  centerWrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background:
      'linear-gradient(135deg, #0f172a 0%, #111827 40%, #1e293b 100%)',
    padding: '24px',
  },
  card: {
    width: '100%',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '22px',
    padding: '32px',
    boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
    backdropFilter: 'blur(10px)',
  },
  logo: {
    fontSize: '52px',
    marginBottom: '12px',
  },
  title: {
    fontSize: '36px',
    fontWeight: 800,
    margin: 0,
  },
  subtitle: {
    marginTop: '8px',
    color: '#cbd5e1',
    fontSize: '16px',
  },
  heroBox: {
    marginTop: '24px',
    marginBottom: '24px',
    background: 'rgba(255,255,255,0.06)',
    borderRadius: '16px',
    padding: '18px',
  },
  heroText: {
    margin: 0,
    color: '#e2e8f0',
    lineHeight: 1.6,
  },
  googleButton: {
    width: '100%',
    padding: '14px 18px',
    borderRadius: '14px',
    border: 'none',
    background: 'white',
    color: '#111827',
    fontWeight: 700,
    fontSize: '15px',
    cursor: 'pointer',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '24px',
    flexWrap: 'wrap',
  },
  headerTitle: {
    margin: 0,
    fontSize: '28px',
    fontWeight: 800,
  },
  headerSubtitle: {
    margin: '4px 0 0 0',
    color: '#cbd5e1',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  userText: {
    color: '#cbd5e1',
    fontSize: '14px',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: '300px 1fr',
    gap: '24px',
  },
  sidebar: {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '22px',
    padding: '18px',
    height: 'fit-content',
  },
  sidebarTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  profileList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  profileButton: {
    textAlign: 'left',
    padding: '14px',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.04)',
    color: 'white',
    cursor: 'pointer',
  },
  profileButtonActive: {
    background: 'rgba(59,130,246,0.28)',
    border: '1px solid rgba(96,165,250,0.55)',
  },
  profileName: {
    fontWeight: 700,
    marginBottom: '4px',
  },
  profileMeta: {
    fontSize: '13px',
    color: '#cbd5e1',
  },
  sidebarActions: {
    marginTop: '16px',
    display: 'grid',
    gap: '10px',
  },
  main: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  cardSection: {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '22px',
    padding: '22px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '18px',
    flexWrap: 'wrap',
  },
  sectionTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 800,
  },
  saveText: {
    color: '#93c5fd',
    fontSize: '14px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '14px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '13px',
    color: '#cbd5e1',
    fontWeight: 600,
  },
  input: {
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    color: 'white',
    padding: '12px 14px',
    outline: 'none',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '16px',
  },
  statCard: {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '22px',
    padding: '20px',
  },
  statTitle: {
    color: '#cbd5e1',
    fontSize: '14px',
    marginBottom: '8px',
  },
  statValue: {
    fontSize: '28px',
    fontWeight: 800,
  },
  analysisBox: {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: '16px',
    padding: '18px',
    lineHeight: 1.7,
    color: '#e2e8f0',
  },
  programGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
  },
  programCard: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '18px',
    padding: '18px',
  },
  programTitle: {
    marginTop: 0,
    marginBottom: '12px',
    fontSize: '18px',
  },
  primaryButton: {
    padding: '10px 14px',
    borderRadius: '12px',
    border: 'none',
    background: '#2563eb',
    color: 'white',
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondaryButton: {
    padding: '10px 14px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.06)',
    color: 'white',
    fontWeight: 700,
    cursor: 'pointer',
  },
  secondaryButtonFull: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.06)',
    color: 'white',
    fontWeight: 700,
    cursor: 'pointer',
  },
  deleteButton: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '12px',
    border: 'none',
    background: '#dc2626',
    color: 'white',
    fontWeight: 700,
    cursor: 'pointer',
  },
};

export default App;