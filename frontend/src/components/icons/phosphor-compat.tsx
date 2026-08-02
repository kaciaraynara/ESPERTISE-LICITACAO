import type { ComponentType } from 'react';
import type { IconProps } from '@phosphor-icons/react';
import {
  ArrowClockwise,
  ArrowLeft as PhArrowLeft,
  ArrowRight as PhArrowRight,
  ArrowSquareOut,
  ArrowsIn,
  ArrowsOut,
  Bell as PhBell,
  BookOpen as PhBookOpen,
  Briefcase as PhBriefcase,
  Buildings,
  Calculator as PhCalculator,
  Calendar as PhCalendar,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  ChartBar,
  ChatCenteredText,
  CheckCircle as PhCheckCircle,
  Checks,
  ClipboardText,
  Clock as PhClock,
  CloudArrowDown,
  CloudArrowUp,
  Copy as PhCopy,
  CreditCard as PhCreditCard,
  Crosshair as PhCrosshair,
  CurrencyDollarSimple,
  Database as PhDatabase,
  DotsThree,
  Download as PhDownload,
  EnvelopeSimple,
  Factory as PhFactory,
  FileText as PhFileText,
  FlowArrow,
  FloppyDisk,
  FolderOpen as PhFolderOpen,
  Gavel as PhGavel,
  Gauge,
  Gear,
  Globe as PhGlobe,
  Info as PhInfo,
  Lightning,
  Link as PhLink,
  List,
  Lock as PhLock,
  MagnifyingGlass,
  MapPin as PhMapPin,
  Package as PhPackage,
  PaperPlaneTilt,
  Phone as PhPhone,
  Plus as PhPlus,
  Power as PhPower,
  Pulse,
  Receipt as PhReceipt,
  Scales,
  Scroll,
  SealCheck,
  Shield as PhShield,
  ShieldCheck as PhShieldCheck,
  ShieldWarning,
  ShoppingBag as PhShoppingBag,
  Signature,
  SignOut,
  SlidersHorizontal,
  SpinnerGap,
  Star as PhStar,
  Tag as PhTag,
  Target as PhTarget,
  TrendDown,
  TrendUp,
  Trophy as PhTrophy,
  User as PhUser,
  UserCircle,
  Users as PhUsers,
  Warning,
  WarningCircle,
  WarningOctagon,
  WifiHigh,
  X as PhX,
  XCircle as PhXCircle,
} from '@phosphor-icons/react';

type CompatIconProps = IconProps & {
  strokeWidth?: number;
  absoluteStrokeWidth?: boolean;
};

function thin(IconComponent: ComponentType<IconProps>) {
  function CompatIcon({ weight, strokeWidth, absoluteStrokeWidth, ...props }: CompatIconProps) {
    void strokeWidth;
    void absoluteStrokeWidth;
    return <IconComponent {...props} weight={weight ?? 'thin'} />;
  }

  return CompatIcon;
}

export const Activity = thin(Pulse);
export const AlertCircle = thin(WarningCircle);
export const AlertTriangle = thin(Warning);
export const ArrowLeft = thin(PhArrowLeft);
export const ArrowRight = thin(PhArrowRight);
export const BarChart2 = thin(ChartBar);
export const BarChart3 = thin(ChartBar);
export const Bell = thin(PhBell);
export const BookOpen = thin(PhBookOpen);
export const Briefcase = thin(PhBriefcase);
export const Building2 = thin(Buildings);
export const Calculator = thin(PhCalculator);
export const Calendar = thin(PhCalendar);
export const CheckCheck = thin(Checks);
export const CheckCircle = thin(PhCheckCircle);
export const CheckCircle2 = thin(PhCheckCircle);
export const ChevronDown = thin(CaretDown);
export const ChevronLeft = thin(CaretLeft);
export const ChevronRight = thin(CaretRight);
export const ChevronUp = thin(CaretUp);
export const ClipboardList = thin(ClipboardText);
export const Clock = thin(PhClock);
export const Clock3 = thin(PhClock);
export const Copy = thin(PhCopy);
export const CreditCard = thin(PhCreditCard);
export const Crosshair = thin(PhCrosshair);
export const Database = thin(PhDatabase);
export const DollarSign = thin(CurrencyDollarSimple);
export const Download = thin(PhDownload);
export const DownloadCloud = thin(CloudArrowDown);
export const ExternalLink = thin(ArrowSquareOut);
export const Factory = thin(PhFactory);
export const FileCheck2 = thin(SealCheck);
export const FileSearch = thin(PhFileText);
export const FileSignature = thin(Signature);
export const FileText = thin(PhFileText);
export const Filter = thin(SlidersHorizontal);
export const FolderOpen = thin(PhFolderOpen);
export const Gavel = thin(PhGavel);
export const Globe = thin(PhGlobe);
export const Info = thin(PhInfo);
export const LayoutDashboard = thin(Gauge);
export const Link = thin(PhLink);
export const Loader2 = thin(SpinnerGap);
export const Lock = thin(PhLock);
export const LockKeyhole = thin(PhLock);
export const LogOut = thin(SignOut);
export const Mail = thin(EnvelopeSimple);
export const MapPin = thin(PhMapPin);
export const Maximize2 = thin(ArrowsOut);
export const Menu = thin(List);
export const MessageSquare = thin(ChatCenteredText);
export const Minimize2 = thin(ArrowsIn);
export const MoreHorizontal = thin(DotsThree);
export const Package = thin(PhPackage);
export const Phone = thin(PhPhone);
export const Plus = thin(PhPlus);
export const Power = thin(PhPower);
export const Radar = thin(PhCrosshair);
export const Receipt = thin(PhReceipt);
export const RefreshCw = thin(ArrowClockwise);
export const Save = thin(FloppyDisk);
export const Scale = thin(Scales);
export const ScrollText = thin(Scroll);
export const Search = thin(MagnifyingGlass);
export const Send = thin(PaperPlaneTilt);
export const ServerCrash = thin(WarningOctagon);
export const Settings = thin(Gear);
export const Settings2 = thin(SlidersHorizontal);
export const Shield = thin(PhShield);
export const ShieldAlert = thin(ShieldWarning);
export const ShieldCheck = thin(PhShieldCheck);
export const ShoppingBag = thin(PhShoppingBag);
export const Star = thin(PhStar);
export const Tag = thin(PhTag);
export const Target = thin(PhTarget);
export const TrendingDown = thin(TrendDown);
export const TrendingUp = thin(TrendUp);
export const Trophy = thin(PhTrophy);
export const UploadCloud = thin(CloudArrowUp);
export const User = thin(PhUser);
export const UserRound = thin(UserCircle);
export const Users = thin(PhUsers);
export const Wifi = thin(WifiHigh);
export const Workflow = thin(FlowArrow);
export const X = thin(PhX);
export const XCircle = thin(PhXCircle);
export const Zap = thin(Lightning);



