import Papa from "papaparse";

export interface CsvRow {
  回答番号: string;
  回答日時: string;
  IPアドレス: string;
  企業名: string;
  "部署・役職": string;
  ご担当者名_姓: string;
  ご担当者名_名: string;
  メールアドレス: string;
  電話番号: string;
  "第60回スーパーマーケット・トレードショー2026への出展": string;
  商品名: string;
  商品カテゴリ: string;
  "販売価格（希望小売価格・直販定価）": string;
  購入可能場所: string;
  参考URL: string;
  商品写真: string;
  ご当地のこだわり: string;
  おいしさのこだわり: string;
  パッケージのこだわり: string;
  調理方法のポイントやおすすめの食べ方など: string;
  その他アピールしたいこと: string;
  "協力小売業者様での販売を希望されますか？": string;
  該当商品の食品細菌検査について: string;
  "賞味期限・消費期限検査証について": string;
  "冷凍食品を製造・販売する為の営業許可証について": string;
  エントリー商品に係わる営業許可証について: string;
  食品衛生責任者の設置: string;
  "備考・メッセージ": string;
}

export function parseCsv(csvText: string): CsvRow[] {
  const result = Papa.parse<CsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.replace(/^\uFEFF/, ""),
  });
  return result.data;
}

export interface ParsedImage {
  url: string;
  type: "main" | "sub";
  sortOrder: number;
}

export function parseImageUrls(rawPhotos: string): ParsedImage[] {
  if (!rawPhotos) return [];
  const images: ParsedImage[] = [];
  const lines = rawPhotos.split("\n");
  let sortOrder = 0;

  for (const line of lines) {
    const urlMatch = line.match(/https:\/\/[^\s\]]+\.(jpg|jpeg|png|gif|webp|pdf)/i);
    if (urlMatch) {
      const isMain = line.includes("メインビジュアル");
      images.push({
        url: urlMatch[0],
        type: isMain ? "main" : "sub",
        sortOrder: sortOrder++,
      });
    }
  }

  return images;
}

export function mapCsvRowToEntry(row: CsvRow) {
  return {
    answerNo: row["回答番号"] || "",
    answeredAt: row["回答日時"] || "",
    ipAddress: row["IPアドレス"] || "",
    companyName: row["企業名"] || "",
    department: row["部署・役職"] || "",
    contactLastName: row["ご担当者名_姓"] || "",
    contactFirstName: row["ご担当者名_名"] || "",
    email: row["メールアドレス"] || "",
    phone: row["電話番号"] || "",
    tradeShowExhibition:
      row["第60回スーパーマーケット・トレードショー2026への出展"] || "",
    productName: row["商品名"] || "",
    productCategory: row["商品カテゴリ"] || "",
    price: row["販売価格（希望小売価格・直販定価）"] || "",
    purchaseLocation: row["購入可能場所"] || "",
    referenceUrl: row["参考URL"] || "",
    productPhotosRaw: row["商品写真"] || "",
    localAppeal: row["ご当地のこだわり"] || "",
    tasteAppeal: row["おいしさのこだわり"] || "",
    packageAppeal: row["パッケージのこだわり"] || "",
    cookingMethod: row["調理方法のポイントやおすすめの食べ方など"] || "",
    otherAppeal: row["その他アピールしたいこと"] || "",
    retailPartnership: row["協力小売業者様での販売を希望されますか？"] || "",
    bacteriaInspection: row["該当商品の食品細菌検査について"] || "",
    expirationInspection: row["賞味期限・消費期限検査証について"] || "",
    manufacturingLicense:
      row["冷凍食品を製造・販売する為の営業許可証について"] || "",
    entryProductLicense: row["エントリー商品に係わる営業許可証について"] || "",
    hygieneManager: row["食品衛生責任者の設置"] || "",
    remarks: row["備考・メッセージ"] || "",
  };
}
