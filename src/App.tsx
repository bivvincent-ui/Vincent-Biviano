import { useEffect, useState } from "react";
import { supabase } from "./supabase";

type Profile = {
  id: string;
  user_id: string;
  name: string;
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
  created_at?: string;
};

const emptyProfile = {
  name: "",
  age: null,
  height: null,
  bodyweight: null,
  best_bench: null,
  set_weight: null,
  reps: null,
  rpe: null,
  goal: null,
  bench_days: null,
  grip: "",
  sticking_point: "",
};

function App() {
  const [session, setSession] = useState<any>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(emptyProfile);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      loadProfiles(session.user.id);
    } else {
      setProfiles([]);
    }
  }, [session]);

  const loadProfiles = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Load profiles error:", error);
      return;
    }

    setProfiles(data || []);
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSelectedProfile(null);
    setShowForm(false);
  };

  const handleNewProfile = () => {
    setSelectedProfile(null);
    setFormData(emptyProfile);
    setShowForm(true);
  };

  const handleOpenProfile = (profile: Profile) => {
    setSelectedProfile(profile);
    setFormData({
      name: profile.name || "",
      age: profile.age,
      height: profile.height,
      bodyweight: profile.bodyweight,
      best_bench: profile.best_bench,
      set_weight: profile.set_weight,
      reps: profile.reps,
      rpe: profile.rpe,
      goal: profile.goal,
      bench_days: profile.bench_days,
      grip: profile.grip || "",
      sticking_point: profile.sticking_point || "",
    });
    setShowForm(true);
  };

  const handleDuplicate = async () => {
    if (!selectedProfile || !session?.user?.id) return;

    const duplicated = {
      user_id: session.user.id,
      name: `${selectedProfile.name || "Profile"} Copy`,
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

    const { error } = await supabase.from("profiles").insert([duplicated]);

    if (error) {
      console.error("Duplicate error:", error);
      return;
    }

    await loadProfiles(session.user.id);
  };

  const handleDelete = async () => {
    if (!selectedProfile || !session?.user?.id) return;

    const confirmed = window.confirm("Delete this profile?");
    if (!confirmed) return;

    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", selectedProfile.id);

    if (error) {
      console.error("Delete error:", error);
      return;
    }

    setSelectedProfile(null);
    await loadProfiles(session.user.id);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    const numericFields = [
      "age",
      "height",
      "bodyweight",
      "best_bench",
      "set_weight",
      "reps",
      "rpe",
      "goal",
      "bench_days",
    ];

    setFormData((prev) => ({
      ...prev,
      [name]: numericFields.includes(name)
        ? value === ""
          ? null
          : Number(value)
        : value,
    }));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id) return;

    setLoading(true);

    if (selectedProfile) {
      const { error } = await supabase
        .from("profiles")
        .update(formData)
        .eq("id", selectedProfile.id);

      if (error) {
        console.error("Update error:", error);
        setLoading(false);
        return;
      }
    } else {
      const { error } = await supabase.from("profiles").insert([
        {
          ...formData,
          user_id: session.user.id,
        },
      ]);

      if (error) {
        console.error("Insert error:", error);
        setLoading(false);
        return;
      }
    }

    await loadProfiles(session.user.id);
    setShowForm(false);
    setLoading(false);
  };

  if (!session) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background:
            "linear-gradient(90deg, rgba(4,15,48,1) 0%, rgba(9,28,74,1) 45%, rgba(29,42,69,1) 100%)",
          color: "white",
        }}
      >
        <button
          onClick={handleGoogleLogin}
          style={{
            padding: "14px 24px",
            borderRadius: "12px",
            border: "none",
            background: "#2563eb",
            color: "white",
            fontSize: "16px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Login with Google
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "32px",
        background:
          "linear-gradient(90deg, rgba(4,15,48,1) 0%, rgba(9,28,74,1) 45%, rgba(29,42,69,1) 100%)",
        color: "white",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "32px",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: "48px" }}>Strength Systems</h1>
            <p style={{ marginTop: "8px", fontSize: "28px", opacity: 0.9 }}>
              Bench AI Coach
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <span>{session.user.email}</span>
            <button
              onClick={handleSignOut}
              style={{
                padding: "12px 20px",
                borderRadius: "14px",
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.08)",
                color: "white",
                cursor: "pointer",
              }}
            >
              Sign Out
            </button>
          </div>
        </div>

        {!showForm ? (
          <div
            style={{
              width: "360px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "24px",
              padding: "20px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h2 style={{ margin: 0 }}>Profiles TEST 123</h2>
              <button
                onClick={handleNewProfile}
                style={{
                  padding: "10px 16px",
                  borderRadius: "14px",
                  border: "none",
                  background: "#2563eb",
                  color: "white",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                + New
              </button>
            </div>

            <div style={{ display: "grid", gap: "12px", marginBottom: "16px" }}>
              {profiles.length === 0 ? (
                <div
                  style={{
                    padding: "14px",
                    borderRadius: "14px",
                    background: "rgba(255,255,255,0.06)",
                    opacity: 0.8,
                  }}
                >
                  No profiles yet. Click + New.
                </div>
              ) : (
                profiles.map((profile) => (
                  <button
                    key={profile.id}
                    onClick={() => {
                      setSelectedProfile(profile);
                      handleOpenProfile(profile);
                    }}
                    style={{
                      padding: "14px",
                      borderRadius: "14px",
                      border:
                        selectedProfile?.id === profile.id
                          ? "2px solid #3b82f6"
                          : "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.06)",
                      color: "white",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <strong>{profile.name || "Unnamed Profile"}</strong>
                    <div style={{ opacity: 0.8, marginTop: "4px" }}>
                      Bench: {profile.best_bench ?? "-"} kg
                    </div>
                  </button>
                ))
              )}
            </div>

            <button
              onClick={handleDuplicate}
              disabled={!selectedProfile}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "14px",
                border: "1px solid rgba(255,255,255,0.12)",
                background: !selectedProfile
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(255,255,255,0.08)",
                color: "white",
                cursor: !selectedProfile ? "not-allowed" : "pointer",
                marginBottom: "12px",
              }}
            >
              Duplicate
            </button>

            <button
              onClick={handleDelete}
              disabled={!selectedProfile}
              style={{
                width: "100%",
                padding: "14px",
                borderRadius: "14px",
                border: "none",
                background: !selectedProfile ? "#7f1d1d" : "#ef4444",
                color: "white",
                fontWeight: 700,
                cursor: !selectedProfile ? "not-allowed" : "pointer",
              }}
            >
              Delete
            </button>
          </div>
        ) : (
          <div
            style={{
              maxWidth: "760px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "24px",
              padding: "24px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h2 style={{ margin: 0 }}>
                {selectedProfile ? "Edit Profile" : "New Profile"}
              </h2>

              <button
                onClick={() => setShowForm(false)}
                style={{
                  padding: "10px 16px",
                  borderRadius: "14px",
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.08)",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                Back
              </button>
            </div>

            <form onSubmit={handleSaveProfile}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "16px",
                }}
              >
                <input name="name" placeholder="Name" value={formData.name} onChange={handleChange} />
                <input name="age" placeholder="Age" type="number" value={formData.age ?? ""} onChange={handleChange} />
                <input name="height" placeholder="Height" type="number" value={formData.height ?? ""} onChange={handleChange} />
                <input name="bodyweight" placeholder="Bodyweight" type="number" value={formData.bodyweight ?? ""} onChange={handleChange} />
                <input name="best_bench" placeholder="Best Bench" type="number" value={formData.best_bench ?? ""} onChange={handleChange} />
                <input name="set_weight" placeholder="Working Set Weight" type="number" value={formData.set_weight ?? ""} onChange={handleChange} />
                <input name="reps" placeholder="Reps" type="number" value={formData.reps ?? ""} onChange={handleChange} />
                <input name="rpe" placeholder="RPE" type="number" step="0.5" value={formData.rpe ?? ""} onChange={handleChange} />
                <input name="goal" placeholder="Bench Goal" type="number" value={formData.goal ?? ""} onChange={handleChange} />
                <input name="bench_days" placeholder="Bench Days Per Week" type="number" value={formData.bench_days ?? ""} onChange={handleChange} />

                <select name="grip" value={formData.grip} onChange={handleChange}>
                  <option value="">Select Grip</option>
                  <option value="close">Close Grip</option>
                  <option value="medium">Medium Grip</option>
                  <option value="wide">Wide Grip</option>
                </select>

                <select
                  name="sticking_point"
                  value={formData.sticking_point}
                  onChange={handleChange}
                >
                  <option value="">Select Sticking Point</option>
                  <option value="off_chest">Off Chest</option>
                  <option value="mid_range">Mid Range</option>
                  <option value="lockout">Lockout</option>
                </select>
              </div>

              <div style={{ marginTop: "24px", display: "flex", gap: "12px" }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    padding: "14px 22px",
                    borderRadius: "14px",
                    border: "none",
                    background: "#2563eb",
                    color: "white",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {loading ? "Saving..." : "Save Profile"}
                </button>

                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  style={{
                    padding: "14px 22px",
                    borderRadius: "14px",
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.08)",
                    color: "white",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      <style>{`
        input, select {
          width: 100%;
          padding: 14px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.06);
          color: white;
          font-size: 15px;
          outline: none;
          box-sizing: border-box;
        }

        option {
          color: black;
        }
      `}</style>
    </div>
  );
}

export default App;