'use client'

import { useRef, useState } from "react"
import { Camera } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { resizeImageFile } from "@/lib/image-resize"

type SignResponse = {
    cloudName: string
    apiKey: string
    timestamp: number
    signature: string
    folder: string
}

// Reused for both an artist's single profile photo and each portfolio image
// — this component's only job is "get one file from the admin's device onto
// Cloudinary and hand back the resulting URL." What the caller does with
// that URL (PATCH Artist.photoUrl, or POST a new PortfolioImage) is entirely
// up to the parent, which is what makes this reusable for both.
export function PhotoUploadField({
    label,
    onUploaded,
}: {
    label: string
    onUploaded: (url: string) => void
}) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [uploading, setUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleFileSelected(file: File) {
        setError(null)
        setUploading(true)

        try {
            // Step 1's route — proves to Cloudinary this request really came
            // from our admin-gated server, without ever putting the API
            // secret in browser-visible code.
            const signRes = await fetch("/api/admin/uploads/sign", { method: "POST" })
            if (!signRes.ok) {
                setError("Couldn't start the upload. Please try again.")
                return
            }
            const sign: SignResponse = await signRes.json()

            const resized = await resizeImageFile(file)

            // Every field here must match exactly what the server signed —
            // Cloudinary recomputes the same signature from these values and
            // rejects the upload if anything (including which fields are
            // present) differs from what was actually signed.
            const formData = new FormData()
            formData.append("file", resized)
            formData.append("api_key", sign.apiKey)
            formData.append("timestamp", String(sign.timestamp))
            formData.append("signature", sign.signature)
            formData.append("folder", sign.folder)

            // Straight to Cloudinary, not our own server — the file's bytes
            // never pass through a Next.js route or touch our database.
            const uploadRes = await fetch(
                `https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`,
                { method: "POST", body: formData }
            )

            if (!uploadRes.ok) {
                setError("Upload failed. Please try again.")
                return
            }

            const uploaded = await uploadRes.json()
            onUploaded(uploaded.secure_url as string)
        } catch (err) {
            console.error("Upload failed:", err)
            setError("Network error. Please try again.")
        } finally {
            setUploading(false)
            if (inputRef.current) inputRef.current.value = ""
        }
    }

    return (
        <div>
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFileSelected(file)
                }}
            />

            <Button
                type="button"
                variant="secondary"
                size="md"
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
            >
                {uploading ? (
                    <>
                        <Spinner className="h-4 w-4" />
                        Uploading...
                    </>
                ) : (
                    <>
                        <Camera className="h-4 w-4" aria-hidden />
                        {label}
                    </>
                )}
            </Button>

            {error && (
                <p role="alert" className="mt-2 text-sm text-danger">
                    {error}
                </p>
            )}
        </div>
    )
}
