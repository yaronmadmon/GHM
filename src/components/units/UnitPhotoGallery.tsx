"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Trash2, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Photo {
  id: string;
  url: string;
  caption?: string | null;
}

export function UnitPhotoGallery({ unitId, initialPhotos }: { unitId: string; initialPhotos: Photo[] }) {
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const uploaded: Photo[] = [];
    for (const file of Array.from(files)) {
      if (file.size > 8 * 1024 * 1024) { toast.error(`${file.name} exceeds 8 MB`); continue; }
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/units/${unitId}/photos`, { method: "POST", body: fd });
      if (!res.ok) { toast.error(`Failed to upload ${file.name}`); continue; }
      uploaded.push(await res.json());
    }
    if (uploaded.length) {
      setPhotos((prev) => [...prev, ...uploaded]);
      toast.success(`${uploaded.length} photo${uploaded.length > 1 ? "s" : ""} uploaded`);
    }
    setUploading(false);
  }

  async function deletePhoto(photoId: string) {
    const res = await fetch(`/api/units/${unitId}/photos/${photoId}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Failed to delete photo"); return; }
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    toast.success("Photo deleted");
  }

  return (
    <div className="space-y-3">
      {photos.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center h-36 border-2 border-dashed rounded-xl text-muted-foreground cursor-pointer hover:border-primary hover:text-primary transition-colors"
          onClick={() => inputRef.current?.click()}
        >
          <Camera className="h-8 w-8 mb-2" />
          <p className="text-sm font-medium">Add listing photos</p>
          <p className="text-xs mt-0.5">Click to upload · JPG, PNG, WEBP · Max 8 MB each</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group rounded-lg overflow-hidden aspect-video bg-muted">
              <img src={photo.url} alt="Unit photo" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  onClick={() => deletePhoto(photo.id)}
                  className="p-1.5 rounded-md bg-white/20 hover:bg-red-500/70 text-white transition-colors"
                  title="Delete photo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="aspect-video border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            <span className="text-xs mt-1">{uploading ? "Uploading…" : "Add photos"}</span>
          </button>
        </div>
      )}

      {photos.length === 0 && (
        <Button variant="outline" size="sm" className="gap-2" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "Uploading…" : "Upload photos"}
        </Button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
      />
    </div>
  );
}
