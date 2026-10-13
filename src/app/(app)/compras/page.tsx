'use client';
import { useEffect, useState } from 'react';
import { Doc, History } from '@/lib/doc';

export default function Compras() {
  const [tab, setTab] = useState('new');
  useEffect(() => { if (location.search.includes('tab=hist')) setTab('hist'); }, []);
  return (
    <>
      <div className="tt"><button className={tab === 'new' ? 'b' : 's'} onClick={() => setTab('new')}>Nueva compra</button><button className={tab === 'hist' ? 'b' : 's'} onClick={() => setTab('hist')}>Historial</button></div>
      {tab === 'new' ? <Doc kind="purchase" /> : <History kind="purchases" />}
    </>
  );
}
