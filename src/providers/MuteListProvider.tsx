import { createMuteListDraftEvent } from '@/lib/draft-event'
import { getLatestEvent } from '@/lib/event'
import { extractPubkeysFromEventTags, isSameTag } from '@/lib/tag'
import client from '@/services/client.service'
import storage from '@/services/storage.service'
import { Event, kinds } from 'nostr-tools'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { useNostr } from './NostrProvider'

type TMuteListContext = {
  mutePubkeys: string[]
  mutePubkey: (pubkey: string) => Promise<void>
  unmutePubkey: (pubkey: string) => Promise<void>
}

const MuteListContext = createContext<TMuteListContext | undefined>(undefined)

export const useMuteList = () => {
  const context = useContext(MuteListContext)
  if (!context) {
    throw new Error('useMuteList must be used within a MuteListProvider')
  }
  return context
}

export function MuteListProvider({ children }: { children: React.ReactNode }) {
  const { pubkey: accountPubkey, publish, relayList, nip04Decrypt, nip04Encrypt } = useNostr()
  const [muteListEvent, setMuteListEvent] = useState<Event | undefined>(undefined)
  const [tags, setTags] = useState<string[][]>([])
  const mutePubkeys = useMemo(() => extractPubkeysFromEventTags(tags), [tags])

  useEffect(() => {
    if (!muteListEvent) {
      setTags([])
      return
    }

    const updateTags = async () => {
      const tags = muteListEvent.tags
      if (muteListEvent.content && accountPubkey) {
        try {
          const plainText = await nip04Decrypt(accountPubkey, muteListEvent.content)
          const contentTags = z.array(z.array(z.string())).parse(JSON.parse(plainText))
          tags.push(...contentTags.filter((tag) => tags.every((t) => !isSameTag(t, tag))))
        } catch {
          // ignore
        }
      }
      setTags(tags)
    }
    updateTags()
  }, [muteListEvent])

  useEffect(() => {
    if (!accountPubkey) return

    const init = async () => {
      setMuteListEvent(undefined)
      const storedMuteListEvent = storage.getAccountMuteListEvent(accountPubkey)
      if (storedMuteListEvent) {
        setMuteListEvent(storedMuteListEvent)
      }
      const events = await client.fetchEvents(relayList?.write ?? client.getDefaultRelayUrls(), {
        kinds: [kinds.Mutelist],
        authors: [accountPubkey]
      })
      const muteEvent = getLatestEvent(events) as Event | undefined
      if (muteEvent) {
        setMuteListEvent(muteEvent)
      }
    }

    init()
  }, [accountPubkey])

  const updateMuteListEvent = (event: Event) => {
    const isNew = storage.setAccountMuteListEvent(event)
    if (!isNew) return
    setMuteListEvent(event)
  }

  const mutePubkey = async (pubkey: string) => {
    if (!accountPubkey) return

    const newTags = tags.concat([['p', pubkey]])
    const cipherText = await nip04Encrypt(accountPubkey, JSON.stringify(newTags))
    const newMuteListDraftEvent = createMuteListDraftEvent(muteListEvent?.tags ?? [], cipherText)
    const newMuteListEvent = await publish(newMuteListDraftEvent)
    updateMuteListEvent(newMuteListEvent)
  }

  const unmutePubkey = async (pubkey: string) => {
    if (!accountPubkey || !muteListEvent) return

    const newTags = tags.filter((tag) => tag[0] !== 'p' || tag[1] !== pubkey)
    const cipherText = await nip04Encrypt(accountPubkey, JSON.stringify(newTags))
    const newMuteListDraftEvent = createMuteListDraftEvent(
      muteListEvent.tags.filter((tag) => tag[0] !== 'p' || tag[1] !== pubkey),
      cipherText
    )
    const newMuteListEvent = await publish(newMuteListDraftEvent)
    updateMuteListEvent(newMuteListEvent)
  }

  return (
    <MuteListContext.Provider value={{ mutePubkeys, mutePubkey, unmutePubkey }}>
      {children}
    </MuteListContext.Provider>
  )
}
