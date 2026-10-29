import { loadRetailPage } from "@/lib/retail";
import { getEmailFooterSettings } from "@/lib/settings";
import { RetailAnswerForm } from "./answer-form";

export const dynamic = "force-dynamic";

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="sec">
      <div className="wrap entry-notice">
        <h1 className="h2">{title}</h1>
        <div className="lead">{children}</div>
      </div>
    </section>
  );
}

export default async function RetailAnswerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [data, footer] = await Promise.all([loadRetailPage(token), getEmailFooterSettings()]);
  const contact = (
    <p>
      お手数ですが、{footer.senderName}（<a href={`mailto:${footer.contactEmail}`}>{footer.contactEmail}</a>）までお問い合わせください。
    </p>
  );

  if (!data) {
    return (
      <Notice title="このページは開けません">
        <p>URLが正しくないか、新しいURLに切り替わっています。案内メールに記載のURLをご確認ください。</p>
        {contact}
      </Notice>
    );
  }
  if (data.products.length === 0 || data.campaigns.length === 0) {
    return (
      <Notice title="現在、ご回答いただく企画はありません">
        <p>新しい企画の募集が始まりましたら、あらためてご案内いたします。</p>
        {contact}
      </Notice>
    );
  }

  return (
    <>
      <section className="entry-hero">
        <div className="wrap">
          <p className="eyebrow">Retail</p>
          <h1 className="h2">流通企画への参加のご回答</h1>
          <p className="lead">
            ご当地冷凍食品大賞の受賞商品を、小売店・通販サイトでご紹介する企画です。受賞商品ごとに、各企画への参加のご希望をお知らせください。締切までは、このページから何度でも回答を変更できます。
          </p>
        </div>
      </section>
      <section className="sec entry-sec">
        <div className="wrap">
          <RetailAnswerForm
            token={token}
            campaigns={data.campaigns.map((c) => ({ ...c, deadline: c.deadline?.toISOString() ?? null }))}
            products={data.products.map((p) => ({
              id: p.id,
              productName: p.productName,
              companyName: p.companyName,
              year: p.year,
              prizeLevel: p.prizeLevel,
              grandPrix: p.grandPrix,
              answers: p.answers,
            }))}
            respondentName={data.respondentName}
            respondentContact={data.respondentContact}
            contactEmail={footer.contactEmail}
          />
        </div>
      </section>
    </>
  );
}
