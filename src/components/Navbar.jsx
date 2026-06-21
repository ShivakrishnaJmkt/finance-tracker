import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase";

export default function Navbar() {
  const [user] = useAuthState(auth);

  return (
    <div className="flex items-center gap-3 p-4">
      <img
         src={auth.currentUser?.photoURL || "/default-avatar.png"}
        alt="Profile"
        className="w-12 h-12 rounded-full object-cover border border-purple-500"
      />

      <div>
        <p className="text-sm font-semibold text-purple-300">
          {user?.displayName || "User"}
        </p>
        <p className="text-xs text-gray-400">{user?.email}</p>
      </div>
    </div>
  );
}
