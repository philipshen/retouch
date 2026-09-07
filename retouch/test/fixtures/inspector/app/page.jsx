import { Card } from '../components/Card';
export default function Page() {
  return <main className="p-10">
    <h1 className="type-editorial mb-4">A place for good ideas</h1>
    <p className="mb-8 text-base">Select a layer and make it yours.</p>
    <section id="anchor-parent" className="relative w-full h-[360px] p-6 bg-white rounded-xl">
      <div id="anchor-target" className="w-[180px] h-[100px] p-4 bg-blue-100 rounded-lg md:opacity-90">Anchor card</div>
      <div id="spacing-target" className="mt-8 p-5 w-[180px] bg-gray-100">Spacing card</div>
    </section>
    <img id="swap-image" src="/first.svg" className="mt-6 w-[240px] h-[120px] object-cover rounded-lg" alt="Color study" />
    <div className="flex gap-6 mt-6">
      <Card title="First card" tone="quiet" />
      <Card title="Second card" tone="bright" />
    </div>
  </main>;
}
