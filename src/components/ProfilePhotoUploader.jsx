// ProfileImageUploader.jsx
import { useState } from "react";

// ఇక్కడ నీ Cloudinary details పెట్టాలి
const CLOUD_NAME = "dok5qnux9";          // ఉదా: "dkxyz123"
const UPLOAD_PRESET = "credix_pro_pic";  // ఉదా: "react_profile";

export default function ProfileImageUploader({ onUploaded }) {
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET); // unsigned preset [web:17][web:45]

    setUploading(true);
    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME }/image/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json(); // data.secure_url → hosted image URL [web:17][web:47]

      if (data.secure_url && onUploaded) {
        onUploaded(data.secure_url);
      } else {
        alert("Upload failed. Check Cloudinary response in console.");
        console.log("Cloudinary response:", data);
      }
    } catch (err) {
      console.error(err);
      alert("Upload error. See console.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-2 text-xs">
      <label className="cursor-pointer text-purple-400 hover:underline">
        {uploading ? "Uploading..." : "Change photo"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </label>
    </div>
  );
}
