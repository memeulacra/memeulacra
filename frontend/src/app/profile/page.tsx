'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function ProfilePage() {
  const [profile, setProfile] = useState({
    email: 'user@example.com',
    npub: 'npub1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    nickname: 'CryptoArtist',
    ethAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
  })

  const [isEditing, setIsEditing] = useState(false)
  // Flag to signal the component has mounted (client-only)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const handleSave = () => {
    // Typically, you would send the updated profile to your backend here.
    console.log('Saving profile:', profile)
    setIsEditing(false)
  }

  return (
    <div className="container mx-auto p-4">
      {/*
          On the first render (during SSR) we render a static div.
          Once mounted on the client, we show the animated content.
      */}
      {isMounted ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="w-full max-w-2xl mx-auto border border-transparent animate-gradient-glow">
            <CardHeader>
              <CardTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-500">
                User Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    disabled={!isEditing}
                    className="bg-gray-700/50"
                  />
                </div>
                <div>
                  <Label htmlFor="ethAddress">ETH Address</Label>
                  <Input
                    id="ethAddress"
                    value={profile.ethAddress}
                    readOnly
                    className="bg-gray-700/50 text-gray-400 cursor-not-allowed"
                  />
                </div>
                <div>
                  <Label htmlFor="npub">NPUB (Nostr Public Key)</Label>
                  <Input
                    id="npub"
                    value={profile.npub}
                    onChange={(e) => setProfile({ ...profile, npub: e.target.value })}
                    disabled={!isEditing}
                    className="bg-gray-700/50"
                  />
                </div>
                <div>
                  <Label htmlFor="nickname">Nickname</Label>
                  <Input
                    id="nickname"
                    value={profile.nickname}
                    onChange={(e) => setProfile({ ...profile, nickname: e.target.value })}
                    disabled={!isEditing}
                    className="bg-gray-700/50"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  {isEditing ? (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => setIsEditing(false)}
                        className="border-purple-500/50 hover:bg-purple-500/10"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSave}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                      >
                        Save
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={() => setIsEditing(true)}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    >
                      Edit
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        // Render a fallback that matches the non-animated structure
        <div className="w-full max-w-2xl mx-auto">
          <Card className="border border-transparent">
            <CardHeader>
              <CardTitle className="text-2xl font-bold">User Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={profile.email}
                    disabled={!isEditing}
                    className="bg-gray-700/50"
                  />
                </div>
                <div>
                  <Label htmlFor="ethAddress">ETH Address</Label>
                  <Input
                    id="ethAddress"
                    value={profile.ethAddress}
                    readOnly
                    className="bg-gray-700/50 text-gray-400 cursor-not-allowed"
                  />
                </div>
                <div>
                  <Label htmlFor="npub">NPUB (Nostr Public Key)</Label>
                  <Input
                    id="npub"
                    value={profile.npub}
                    disabled={!isEditing}
                    className="bg-gray-700/50"
                  />
                </div>
                <div>
                  <Label htmlFor="nickname">Nickname</Label>
                  <Input
                    id="nickname"
                    value={profile.nickname}
                    disabled={!isEditing}
                    className="bg-gray-700/50"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  {isEditing ? (
                    <>
                      <Button variant="outline" onClick={() => setIsEditing(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSave}>Save</Button>
                    </>
                  ) : (
                    <Button onClick={() => setIsEditing(true)}>Edit</Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
