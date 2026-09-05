import 'package:flutter/material.dart';

import '../app/gameplay_locale.dart';
import '../models/game_snapshot.dart';
import '../widgets/metric_tile.dart';
import '../widgets/section_card.dart';

/// Career and product-identity screen for the first mobile shell.
class CareerScreen extends StatelessWidget {
  const CareerScreen({required this.snapshot, super.key});

  final GameSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    return ListView(
      key: const PageStorageKey<String>('career-scroll'),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 120),
      children: <Widget>[
        ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: AspectRatio(
            aspectRatio: 16 / 9,
            child: Image.asset(
              'assets/branding/genesis_ai_juris_logo.png',
              fit: BoxFit.cover,
              alignment: Alignment.center,
              semanticLabel: 'GENESIS: AI Juris logo',
            ),
          ),
        ),
        const SizedBox(height: 16),
        LayoutBuilder(
          builder: (BuildContext context, BoxConstraints constraints) {
            final bool wide = constraints.maxWidth >= 500;
            final double width =
                wide ? (constraints.maxWidth - 12) / 2 : constraints.maxWidth;
            return Wrap(
              spacing: 12,
              runSpacing: 12,
              children: <Widget>[
                SizedBox(
                  width: width,
                  child: MetricTile(
                    label: GameplayLocale.text(
                      context,
                      'Ethical standing',
                      'Этическая репутация',
                    ),
                    value: '${snapshot.ethics}/100',
                    detail: GameplayLocale.text(
                      context,
                      'Long-term professional capital',
                      'Долгосрочный профессиональный капитал',
                    ),
                    icon: Icons.balance_outlined,
                    progress: snapshot.ethics / 100,
                  ),
                ),
                SizedBox(
                  width: width,
                  child: MetricTile(
                    label: GameplayLocale.text(
                      context,
                      'Client trust',
                      'Доверие клиента',
                    ),
                    value: '${snapshot.clientTrust}/100',
                    detail: GameplayLocale.text(
                      context,
                      'Confidence in advice and budget control',
                      'Уверенность в советах и контроле бюджета',
                    ),
                    icon: Icons.handshake_outlined,
                    progress: snapshot.clientTrust / 100,
                  ),
                ),
              ],
            );
          },
        ),
        const SizedBox(height: 16),
        SectionCard(
          title: GameplayLocale.text(
            context,
            'Vertical slice status',
            'Статус вертикального среза',
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                '${GameplayLocale.text(context, 'Mobile shell', 'Мобильная оболочка')} v${snapshot.version}',
              ),
              const SizedBox(height: 8),
              Text(
                GameplayLocale.text(
                  context,
                  'This build proves the smartphone-first information architecture. '
                      'The deterministic Rust engine remains authoritative and will be '
                      'connected through a narrow snapshot/action bridge in v0.5.1.',
                  'Эта сборка демонстрирует мобильную информационную архитектуру. '
                      'Детерминированный Rust-движок остаётся авторитетным и подключён '
                      'через узкий мост snapshot/action.',
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
