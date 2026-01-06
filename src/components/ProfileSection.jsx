// components/ProfileSection.jsx
import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../AuthContext";
import ProfileImageUploader from "./ProfilePhotoUploader";

export default function ProfileSection() {
  const { user } = useAuth();
  const [photoUrl, setPhotoUrl] = useState(null);

  useEffect(() => {
    if (!user?.uid) return;

    const ref = doc(db, `users/${user.uid}/profile/img`);

    // realtime listen (optional; or use getDoc once)
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setPhotoUrl(snap.data().url);
      }
    });

    return () => unsub();
  }, [user?.uid]);

  return (
    <div>
      <div className="flex items-center gap-2">
        <img
          src={photoUrl || "/default-avatar.png"}
          alt="profile"
          className="h-10 w-10 rounded-full object-cover"
        />
        {/* name / email here */}
      </div>

      <ProfileImageUploader onUploaded={(url) => setPhotoUrl(url)} />
    </div>
  );
}
