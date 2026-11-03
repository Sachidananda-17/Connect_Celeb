"use client";

import Image from "next/image";
import { ChangeEvent, useRef } from "react";

interface ImageUploadProps {
  value: string;
  onChange: (src: string) => void;
  disabled?: boolean;
}

// Resize to a 320px square JPEG data URL (~20-40KB) so it can be stored directly
// in the database — no external image host needed.
export const toAvatarDataUrl = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = document.createElement("img");
    img.onload = () => {
      const size = 320;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const side = Math.min(img.width, img.height);
      canvas
        .getContext("2d")!
        .drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });

export const ImageUpload = ({ value, onChange, disabled }: ImageUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onChange(await toAvatarDataUrl(file));
    e.target.value = "";
  };

  return (
    <div className="space-y-4 w-full flex flex-col justify-center items-center">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        disabled={disabled}
        onChange={onFile}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="p-4 border-4 border-dashed border-primary/10 rounded-lg hover:opacity-75 transition flex flex-col space-y-2 items-center justify-center"
      >
        <div className="relative h-40 w-40">
          <Image
            fill
            alt="Upload"
            src={value || "/placeholder.svg"}
            className="rounded-lg object-cover"
          />
        </div>
      </button>
    </div>
  );
};
